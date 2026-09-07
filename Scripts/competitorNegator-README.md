# 🔍 Competitor Negator Tool

A Google Ads script that automatically identifies and flags competitor brand terms in your search query reports by cross-referencing with Companies House data.

---

## 🎯 What This Tool Does

The Competitor Negator helps PPC managers:

1. **Identify competitor brand terms** in your search query reports
2. **Filter out location-based terms** that aren't actually competitors
3. **Save hours of manual work** reviewing search terms
4. **Prevent wasted ad spend** on competitor terms you don't want to target

---

## ⚙️ How It Works

1. **Pulls your search term data** from Google Ads using GAQL
2. **Checks each term against Companies House** to see if it's a registered business name
3. **Applies intelligent filtering** to avoid false positives:
   - Ignores terms containing locations (e.g., "plumber london")
   - Skips terms on your custom exception lists
   - Handles special character terms appropriately
4. **Exports results to Google Sheets** with clear Yes/No competitor flags

---

## 🛠️ Setup Instructions

1. **Create your Google Sheet**
   - Make a copy of [this template sheet](https://docs.google.com/spreadsheets/d/1gf8mj1aTU3FfYm4DspKmHHjxz3-WYlF8sIMH1Jy7QSs/edit?usp=sharing)
   - Set up the following named ranges:
     - `lookback`: Time period for search terms (e.g., "LAST_30_DAYS")
     - `minor_locations`: List of location terms to ignore
     - `reserved_words`: Terms that should never be flagged as competitors
     - `leading_words`: Terms that, when appearing at the start, exclude a term from checks

2. **Location Configuration (Control Centre)**
   - Enable/disable location lists with these named ranges:
     - `use_england`: Whether to use England locations list
     - `england_locations`: List of England locations
     - `use_scotland`: Whether to use Scotland locations list
     - `scotland_locations`: List of Scotland locations
     - `use_wales`: Whether to use Wales locations list
     - `wales_locations`: List of Wales locations
     - `use_northern_ireland`: Whether to use Northern Ireland locations list
     - `northern_ireland_locations`: List of Northern Ireland locations
     - `use_broad`: Whether to use broad locations list
     - `broad_locations`: List of broad location terms

3. **Update the Script Configuration**
   - Copy the script to your Google Ads account (Tools & Settings > Bulk Actions > Scripts)
   - Set your `SHEET_URL` in the configuration section
   - Customize the `TAB_NAME` if needed (default is "Raw Data")

---

## 📊 Output Explanation

The script adds three columns to your search term report:

| Column | Description |
|--------|-------------|
| Is Competitor | "Yes" if the term matches a Companies House entry |
| Companies House URL | Link to the search results (only for "Yes" entries) |
| Skip Reason | Explanation if the term was skipped (e.g., "Contains location") |

---

## 🔧 Advanced Customization

You can modify the GAQL query in the `getGAQLQuery()` function to:
- Change the metrics collected (impressions, clicks, cost, conversions)
- Add additional filters (campaign type, performance thresholds)
- Include other dimensions in your report

---

## ⚠️ Limitations

- The script relies on Companies House data, which only covers UK registered businesses
- Very high search volumes might hit API rate limits
- Some legitimate competitors might be missed if they use non-standard company names

---

## 📝 Notes

- The script automatically logs its progress and any errors to the Google Ads Scripts console
- For optimal performance, run this script weekly rather than daily
- Consider using the output to create negative keyword lists for your campaigns

---

## 🤝 Contribute

Want to improve this tool? Have ideas for new features? Pull requests welcome!

---

## 📋 Disclaimer

This tool is provided as-is for educational purposes. Always review the results before taking action in your Google Ads account.

--- 