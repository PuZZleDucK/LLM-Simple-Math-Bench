# o5 review - LLM Simple Math Bench results

This review covers the four published results files: DeepSeek, Gemma, Granite, and Qwen3. Observations are based on the aggregate (non-case) rows in each CSV.

## Cross-file observations
- Score totals differ by file: DeepSeek/Qwen3 total max is 280, while Gemma/Granite total max is 700. This indicates different scoring scales or per-test max scores between runs.
- In every file, the simple tests (simple addition/subtraction/division/multiplication) are the easiest on average, while advanced operations and BMDAS mixed are consistently the hardest.
- Model size is not a guaranteed predictor of the best outcome within a family; several mid-size variants outperform larger ones.

## DeepSeek (results-deepseek.csv)
General observations
- Best model: deepseek-r1-8b (~93.6% avg, 262/280), a strong jump above the rest of the family.
- Weakest model: deepseek-r1-1.5b (~45.0% avg, 126/280).
- Easiest tests by avg: simple-division, simple-addition, compound-division.
- Hardest tests by avg: advanced-addition, advanced-multiplication, advanced-division.

Model-specific observations
- deepseek-r1-8b is the clear outlier, nearly ceiling on total score and materially ahead of 14b.
- deepseek-r1-14b and deepseek-r1-7b cluster around ~49–52%, indicating size-up alone didn’t yield large gains here.
- josiefied-deepseek-r1-0528-qwen3-8b tracks deepseek-r1-7b almost exactly, suggesting similar behavior under this test mix.

## Gemma (results-gemma.csv)
General observations
- Best model: gemma3n-e4b (~65.7% avg, 460/700).
- Weakest model: gemma3-270m (~17.1% avg, 120/700).
- Easiest tests by avg: simple-multiplication, simple-subtraction, simple-addition (very high success).
- Hardest tests by avg: advanced-subtraction, advanced-division, bmdas-mixed (large drop-off).

Model-specific observations
- The “n” variants (gemma3n-e2b/e4b) outperform the baseline gemma3 sizes at similar or smaller parameter scales.
- gemma3-12b does not beat gemma3n-e4b, suggesting architecture/variant changes matter more than raw size here.
- gemma3-4b sits near 50% overall, a clear step above 1b and 270m, but still far from the top performer.

## Granite (results-granite.csv)
General observations
- Best model: granite4-tiny-h (~62.0% avg, 434/700).
- Weakest model: granite3-moe-1b (~22.1% avg, 155/700).
- Easiest tests by avg: simple-subtraction, simple-addition, simple-division (near-ceiling across the family).
- Hardest tests by avg: advanced-subtraction, bmdas-mixed, advanced-division (very low averages).

Model-specific observations
- granite4-tiny-h leads the family, edging out granite4-1b and granite4-micro.
- granite3-moe-1b is the weakest; the small MoE variant struggles despite the family size naming.
- granite3-3-8b and granite3-dense-8b land in the middle of the pack, not clearly better than smaller granite4 variants.

## Qwen3 (results-qwen3.csv)
General observations
- Best model: qwen3-vl-8b (perfect 280/280).
- Weakest model (among complete rows): qwen3-1.7b (~51.4% avg, 144/280).
- Easiest tests by avg: simple-addition, simple-division, simple-subtraction (high success rates).
- Hardest tests by avg: advanced-division, advanced-addition, advanced-multiplication (still higher than other families).
- Data quality note: there is a blank test_id row in the file, and qwen3-0.6b totals 260/280, suggesting one test missing or an incomplete aggregate row for that model.

Model-specific observations
- The VL variants are strong across sizes; qwen3-vl-8b is perfect, and qwen3-vl-4b beats the base 4b.
- qwen3-8b and qwen3-14b are very close (~95.7% avg), implying diminishing returns past 8b for this test mix.
- Qwen3 Coder 30B (A3B) underperforms relative to general Qwen3 models, indicating coding specialization does not directly transfer to these math tasks.
- qwen3-vl-30b is notably weaker than smaller VL variants, standing out as a negative outlier.
