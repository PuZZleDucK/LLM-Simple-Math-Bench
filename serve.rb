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

def ensure_results_file
  return if File.exist?(RESULTS_FILE) && File.size?(RESULTS_FILE)

  CSV.open(RESULTS_FILE, "w") { |csv| csv << HEADERS }
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

def latest_results
  results = {}
  last_updated = nil

  return [results, last_updated] unless File.exist?(RESULTS_FILE) && File.size?(RESULTS_FILE)

  CSV.foreach(RESULTS_FILE, headers: true) do |row|
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

server.mount_proc "/api/results" do |req, res|
  case req.request_method
  when "GET"
    results, last_updated = latest_results
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
      ensure_results_file
      CSV.open(RESULTS_FILE, "ab") do |csv|
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

  File.delete(RESULTS_FILE) if File.exist?(RESULTS_FILE)
  res.status = 200
  res["Content-Type"] = "application/json"
  res.body = JSON.generate({ ok: true })
end

server.mount_proc "/api/results.csv" do |_req, res|
  res.status = 200
  res["Content-Type"] = "text/csv"
  if File.exist?(RESULTS_FILE) && File.size?(RESULTS_FILE)
    res.body = File.read(RESULTS_FILE)
  else
    res.body = CSV.generate { |csv| csv << HEADERS }
  end
end

trap("INT") { server.shutdown }

puts "Serving http://localhost:#{PORT}"
server.start
