#!/usr/bin/env ruby
# frozen_string_literal: true

require "csv"
require "fileutils"
require "json"
require "time"
require "webrick"

ROOT = File.expand_path(__dir__)
DATA_DIR = File.join(ROOT, "data")
RESULTS_FILE = File.join(DATA_DIR, "results.csv")
PORT = (ENV["PORT"] || 4567).to_i

HEADERS = [
  "timestamp",
  "model",
  "model_size_bytes",
  "model_param_b",
  "test_id",
  "test_name",
  "case_id",
  "case_prompt",
  "expected",
  "score",
  "max_score",
  "output",
  "error",
  "prompt_eval_count",
  "eval_count",
  "prompt_eval_duration",
  "eval_duration",
  "total_duration",
  "load_duration",
  "prompt_tokens_per_second",
  "eval_tokens_per_second",
].freeze

FileUtils.mkdir_p(DATA_DIR)

server = WEBrick::HTTPServer.new(
  Port: PORT,
  DocumentRoot: ROOT,
  AccessLog: [],
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::INFO)
)

def sanitize_results_filename(filename)
  return nil if filename.nil?

  name = filename.to_s.strip
  return nil if name.empty?

  name = File.basename(name)
  return nil unless name.match?(/\Aresults(?:-[a-z0-9][a-z0-9._-]*)?\.csv\z/i)

  name
end

def slugify_run_name(name)
  text = name.to_s.downcase.strip
  return nil if text.empty?

  slug = text.gsub(/[^a-z0-9]+/, "-").gsub(/^-+|-+$/, "")
  return nil if slug.empty?

  slug[0, 64]
end

def resolve_results_path(req, payload = nil)
  file_param = sanitize_results_filename(req.query["file"])
  run_param = req.query["run"]
  payload_run = payload && payload["runName"]

  filename =
    if file_param
      file_param
    elsif run_param
      slug = slugify_run_name(run_param)
      slug ? "results-#{slug}.csv" : nil
    elsif payload_run
      slug = slugify_run_name(payload_run)
      slug ? "results-#{slug}.csv" : nil
    end

  filename ||= "results.csv"
  File.join(DATA_DIR, filename)
end

def ensure_results_file(path)
  unless File.exist?(path) && File.size?(path)
    CSV.open(path, "w") { |csv| csv << HEADERS }
    return
  end

  existing_headers = CSV.open(path, "r", &:shift)
  return if existing_headers == HEADERS

  tmp_path = "#{path}.tmp"
  CSV.open(tmp_path, "w") do |csv|
    csv << HEADERS
    CSV.foreach(path, headers: true) do |row|
      csv << HEADERS.map { |header| row[header] || "" }
    end
  end

  FileUtils.mv(tmp_path, path)
end

def number_or_nil(value)
  return nil if value.nil? || value.to_s.strip.empty?

  Float(value)
rescue ArgumentError, TypeError
  nil
end

def parse_time(value)
  return nil if value.nil? || value.to_s.strip.empty?

  Time.parse(value)
rescue ArgumentError
  nil
end

def normalized_row(row)
  {
    "score" => number_or_nil(row["score"]),
    "maxScore" => number_or_nil(row["max_score"]),
    "output" => row["output"].to_s,
    "error" => row["error"].to_s.strip.empty? ? nil : row["error"],
    "completedAt" => row["timestamp"],
    "promptEvalCount" => number_or_nil(row["prompt_eval_count"]),
    "evalCount" => number_or_nil(row["eval_count"]),
    "promptEvalDuration" => number_or_nil(row["prompt_eval_duration"]),
    "evalDuration" => number_or_nil(row["eval_duration"]),
    "totalDuration" => number_or_nil(row["total_duration"]),
    "loadDuration" => number_or_nil(row["load_duration"]),
    "promptTokensPerSecond" => number_or_nil(row["prompt_tokens_per_second"]),
    "evalTokensPerSecond" => number_or_nil(row["eval_tokens_per_second"]),
  }
end

def latest_results(path)
  results = {}
  last_updated = nil

  return [results, last_updated] unless File.exist?(path) && File.size?(path)

  CSV.foreach(path, headers: true) do |row|
    model = row["model"].to_s
    test_id = row["test_id"].to_s
    case_id = row["case_id"].to_s
    next if model.empty? || test_id.empty?
    next unless case_id.empty?

    timestamp = parse_time(row["timestamp"])
    if timestamp && (!last_updated || timestamp > last_updated)
      last_updated = timestamp
    end

    current = results.dig(model, test_id)
    current_time = parse_time(current && current["completedAt"])
    should_update = current.nil? || (timestamp && (!current_time || timestamp > current_time))

    next unless should_update

    results[model] ||= {}
    results[model][test_id] = normalized_row(row)
  end

  [results, last_updated]
end

server.mount_proc "/api/results-files" do |_req, res|
  files = Dir.glob(File.join(DATA_DIR, "results*.csv"))
    .map { |path| File.basename(path) }
    .sort
  res.status = 200
  res["Content-Type"] = "application/json"
  res.body = JSON.generate({ files: files })
end

server.mount_proc "/api/results" do |req, res|
  case req.request_method
  when "GET"
    results_path = resolve_results_path(req)
    results, last_updated = latest_results(results_path)
    res.status = 200
    res["Content-Type"] = "application/json"
    res.body = JSON.pretty_generate(
      {
        results: results,
        lastUpdated: last_updated&.iso8601,
      }
    )
  when "POST"
    body = req.body.to_s
    payload = body.empty? ? {} : JSON.parse(body)
    entries = payload["entries"] || []
    if entries.empty? && payload["entry"]
      entries = [payload["entry"]]
    end

    if entries.any?
      results_path = resolve_results_path(req, payload)
      ensure_results_file(results_path)
      CSV.open(results_path, "ab") do |csv|
        entries.each do |entry|
          row = HEADERS.map do |header|
            value = entry[header] || entry[header.to_sym]
            value.nil? ? "" : value
          end
          csv << row
        end
      end
    end

    res.status = 201
    res["Content-Type"] = "application/json"
    res.body = JSON.generate({ ok: true, count: entries.size })
  else
    res.status = 405
  end
rescue JSON::ParserError
  res.status = 400
  res["Content-Type"] = "application/json"
  res.body = JSON.generate({ error: "Invalid JSON" })
end

server.mount_proc "/api/clear" do |req, res|
  if req.request_method != "POST"
    res.status = 405
    next
  end

  results_path = resolve_results_path(req)
  File.delete(results_path) if File.exist?(results_path)
  res.status = 200
  res["Content-Type"] = "application/json"
  res.body = JSON.generate({ ok: true })
end

server.mount_proc "/api/results.csv" do |_req, res|
  res.status = 200
  res["Content-Type"] = "text/csv"
  results_path = resolve_results_path(_req)
  if File.exist?(results_path) && File.size?(results_path)
    res.body = File.read(results_path)
  else
    res.body = CSV.generate { |csv| csv << HEADERS }
  end
end

trap("INT") { server.shutdown }

puts "Serving http://localhost:#{PORT}"
server.start
