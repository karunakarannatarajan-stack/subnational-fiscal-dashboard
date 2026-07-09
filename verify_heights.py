import os
import re
import sys

print("Running Y-axis Chart Height Verification Test Cases (Python)...")

html_path = os.path.join(os.path.dirname(__file__), 'index.html')
if not os.path.exists(html_path):
    print("FAIL: index.html not found!")
    sys.exit(1)

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Test Case 1: Validate Interest Payments as % of Own Revenue Receipts Comparison
print("\n--- Test Case 1: Interest Payments as % of Own Revenue Receipts Comparison ---")
own_card_regex = r"<!-- Section 1A: Interest Payments as % of Own Revenue Receipts -->\s*?<div class=\"chart-main-card\" style=\"[^\"]*?height:\s*(\d+)px;[^\"]*?\">[\s\S]*?<div style=\"position: relative; height: (\d+)px; width: 100%;\">[\s\S]*?<canvas id=\"chart-interest-own-combined\""
own_match = re.search(own_card_regex, html)
if not own_match:
    print("FAIL: Could not locate Section 1A card/wrapper pattern.")
    sys.exit(1)
own_card_height = int(own_match.group(1))
own_wrapper_height = int(own_match.group(2))
print(f"Found card height: {own_card_height}px (Expected: 975px)")
print(f"Found wrapper height: {own_wrapper_height}px (Expected: 780px)")
if own_card_height != 975 or own_wrapper_height != 780:
    print("FAIL: Heights do not match expected values!")
    sys.exit(1)
print("PASS: Own Revenue chart heights are correct.")

# Test Case 2: Validate Interest Payments as % of Total Revenue Receipts Comparison
print("\n--- Test Case 2: Interest Payments as % of Total Revenue Receipts Comparison ---")
total_card_regex = r"<!-- Section 1B: Interest Payments as % of Total Revenue Receipts -->\s*?<div class=\"chart-main-card\" style=\"[^\"]*?height:\s*(\d+)px;[^\"]*?\">[\s\S]*?<div style=\"position: relative; height: (\d+)px; width: 100%;\">[\s\S]*?<canvas id=\"chart-interest-total-combined\""
total_match = re.search(total_card_regex, html)
if not total_match:
    print("FAIL: Could not locate Section 1B card/wrapper pattern.")
    sys.exit(1)
total_card_height = int(total_match.group(1))
total_wrapper_height = int(total_match.group(2))
print(f"Found card height: {total_card_height}px (Expected: 975px)")
print(f"Found wrapper height: {total_wrapper_height}px (Expected: 780px)")
if total_card_height != 975 or total_wrapper_height != 780:
    print("FAIL: Heights do not match expected values!")
    sys.exit(1)
print("PASS: Total Revenue chart heights are correct.")

# Test Case 3: Validate Debt to GSDP Ratio Comparison
print("\n--- Test Case 3: Debt to GSDP Ratio Comparison ---")
debt_card_regex = r"<!-- Section 2: Combined Debt-to-GSDP -->\s*?<div class=\"chart-main-card\" style=\"[^\"]*?height:\s*(\d+)px;[^\"]*?\">[\s\S]*?<div style=\"position: relative; height: (\d+)px; width: 100%;\">[\s\S]*?<canvas id=\"chart-debt-combined\""
debt_match = re.search(debt_card_regex, html)
if not debt_match:
    print("FAIL: Could not locate Section 2 card/wrapper pattern.")
    sys.exit(1)
debt_card_height = int(debt_match.group(1))
debt_wrapper_height = int(debt_match.group(2))
print(f"Found card height: {debt_card_height}px (Expected: 975px)")
print(f"Found wrapper height: {debt_wrapper_height}px (Expected: 780px)")
if debt_card_height != 975 or debt_wrapper_height != 780:
    print("FAIL: Heights do not match expected values!")
    sys.exit(1)
print("PASS: Debt Outstanding chart heights are correct.")

# Test Case 4: Validate Contingent Liabilities: Outstanding Guarantees Comparison
print("\n--- Test Case 4: Contingent Liabilities: Outstanding Guarantees Comparison ---")
guar_card_regex = r"<!-- Section 3: Combined Contingent Liabilities -->\s*?<div class=\"chart-main-card\" style=\"[^\"]*?height:\s*(\d+)px;[^\"]*?\">[\s\S]*?<div style=\"position: relative; height: (\d+)px; width: 100%;\">[\s\S]*?<canvas id=\"chart-guar-combined\""
guar_match = re.search(guar_card_regex, html)
if not guar_match:
    print("FAIL: Could not locate Section 3 card/wrapper pattern.")
    sys.exit(1)
guar_card_height = int(guar_match.group(1))
guar_wrapper_height = int(guar_match.group(2))
print(f"Found card height: {guar_card_height}px (Expected: 975px)")
print(f"Found wrapper height: {guar_wrapper_height}px (Expected: 780px)")
if guar_card_height != 975 or guar_wrapper_height != 780:
    print("FAIL: Heights do not match expected values!")
    sys.exit(1)
print("PASS: Outstanding Guarantees chart heights are correct.")

print("\nSUCCESS: All Y-axis chart height test cases passed successfully!")
sys.exit(0)
