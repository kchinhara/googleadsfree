/**
 * adScraper.gs - Google Ads scraper for Google Sheets by Kudakwashe Chinhara
 * 
 * This script scrapes Google Ads using the ValueSERP API and writes the results to the 
 * current Google Sheet. To use this script:
 * 1. Open Google Sheets
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code and save
 * 4. Set up your named ranges in the sheet (see instructions below)
 * 5. Run the main() function or use the custom menu
 */

/**
 * Instructions for setting up named ranges in your Google Sheet:
 * 
 * 1. valueSERP_API_KEY: Cell containing your ValueSERP API key
 * 2. location: Cell containing location (e.g., "Watford,England,United Kingdom")
 * 3. countryCode: Cell containing two-letter country code (e.g., "UK", "US", "AE")
 * 4. keywords: Range containing your keywords (can be multiple cells)
 * 
 * To create named ranges:
 * - Select the cell/range
 * - Go to Data > Named ranges
 * - Enter the name and click Done
 */

/**
 * Creates custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Ad Scraper')
    .addItem('Scrape Google Ads', 'main')
    .addItem('Clear Scraped Data', 'clearScrapedData')
    .addItem('Setup Instructions', 'showSetupInstructions')
    .addToUi();
}

/**
 * Shows setup instructions in a dialog
 */
function showSetupInstructions() {
  const ui = SpreadsheetApp.getUi();
  const message = `Setup Instructions:

1. Get a ValueSERP API key from https://valueserp.com/

2. Create these named ranges in your sheet:
   • valueSERP_API_KEY: Cell with your API key
   • location: Cell with location (e.g., "Watford,England,United Kingdom")
   • countryCode: Cell with country code (e.g., "UK", "US", "AE")
   • keywords: Range with your keywords (one per cell)

3. To create named ranges:
   • Select the cell/range
   • Go to Data > Named ranges
   • Enter the name and click Done

4. Run "Scrape Google Ads" from the Ad Scraper menu`;
  
  ui.alert('Ad Scraper Setup', message, ui.ButtonSet.OK);
}

/**
 * Get Google domain settings from a country code
 * 
 * @param {string} countryCode - Two-letter country code (e.g., "UK", "US", "AE")
 * @return {Object} Object containing domain and gl settings
 */
function getDomainSettings(countryCode) {
  if (!countryCode) {
    return { domain: 'google.com', gl: 'us' }; // Default to US
  }
  
  // Convert to lowercase for consistent handling
  const code = countryCode.toLowerCase();
  
  // Special cases for countries with non-standard domain patterns
  const specialDomains = {
    'uk': { domain: 'google.co.uk', gl: 'uk' },
    'gb': { domain: 'google.co.uk', gl: 'uk' }, // Great Britain (United Kingdom)
    'in': { domain: 'google.co.in', gl: 'in' },
    'jp': { domain: 'google.co.jp', gl: 'jp' },
    'kr': { domain: 'google.co.kr', gl: 'kr' },
    'nz': { domain: 'google.co.nz', gl: 'nz' },
    'za': { domain: 'google.co.za', gl: 'za' },
    'us': { domain: 'google.com', gl: 'us' } // US uses the default domain
  };
  
  // If it's a special case, use that
  if (specialDomains[code]) {
    return specialDomains[code];
  }
  
  // For all other country codes, use the standard pattern
  return {
    domain: `google.${code}`,
    gl: code
  };
}

/**
 * Main function to scrape Google Ads
 */
function main() {
  try {
    // Get the active spreadsheet (no URL needed!)
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Show progress to user
    SpreadsheetApp.getUi().alert('Starting ad scraping...', 'This may take a few moments. Check the execution log for progress.', SpreadsheetApp.getUi().ButtonSet.OK);
    
    // Get input values from named ranges
    const apiKey = getNamedRangeValue(spreadsheet, 'valueSERP_API_KEY');
    const location = getNamedRangeValue(spreadsheet, 'location');
    const countryCode = getNamedRangeValue(spreadsheet, 'countryCode');
    const keywords = getNamedRangeValues(spreadsheet, 'keywords');
    
    // Validate inputs
    if (!apiKey) {
      SpreadsheetApp.getUi().alert('Error', 'API key not found. Please set the valueSERP_API_KEY named range.', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    if (!location) {
      SpreadsheetApp.getUi().alert('Error', 'Location not found. Please set the location named range.', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    if (!countryCode) {
      SpreadsheetApp.getUi().alert('Error', 'Country code not found. Please set the countryCode named range.', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    if (!keywords || keywords.length === 0) {
      SpreadsheetApp.getUi().alert('Error', 'No keywords found. Please add keywords to the keywords named range.', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    console.log(`Starting ad scraping for ${keywords.length} keywords in ${location} (${countryCode})`);
    
    // Get domain settings dynamically from country code
    const domainSettings = getDomainSettings(countryCode);
    console.log(`Using domain: ${domainSettings.domain}, gl: ${domainSettings.gl}`);
    
    // Scrape ads for all keywords
    const allAds = [];
    keywords.forEach(keyword => {
      if (keyword) { // Skip empty cells
        console.log(`Scraping ads for: ${keyword}`);
        const ads = scrapeGoogleAds(apiKey, keyword, location, domainSettings);
        if (ads && ads.length > 0) {
          allAds.push(...ads);
          console.log(`Found ${ads.length} ads for "${keyword}"`);
        } else {
          console.log(`No ads found for "${keyword}"`);
        }
      }
    });
    
    // Write ads to sheet
    if (allAds.length > 0) {
      writeAdsToSheet(spreadsheet, allAds);
      SpreadsheetApp.getUi().alert('Success!', `Successfully scraped ${allAds.length} ads. Check the "Raw Scraped Ads" sheet.`, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      SpreadsheetApp.getUi().alert('No Results', 'No ads found for any keywords. Check your keywords and try again.', SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    SpreadsheetApp.getUi().alert('Error', `An error occurred: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Scrape Google Ads for a given keyword and location
 * 
 * @param {string} apiKey - ValueSERP API key
 * @param {string} keyword - Search keyword
 * @param {string} location - Location string (e.g., "Watford,England,United Kingdom")
 * @param {Object} domainSettings - Object containing domain and gl settings
 * @return {Array} Array of ad objects
 */
function scrapeGoogleAds(apiKey, keyword, location, domainSettings) {
  // Prepare API request parameters
  const params = {
    api_key: apiKey,
    q: keyword,
    location: location,
    gl: domainSettings.gl,
    hl: 'en',
    google_domain: domainSettings.domain,
    include_ai_overview: 'true',
    ads_optimized: 'true'
  };
  
  // Build URL with query parameters
  let url = 'https://api.valueserp.com/search?';
  for (const key in params) {
    url += `${key}=${encodeURIComponent(params[key])}&`;
  }
  url = url.slice(0, -1); // Remove trailing &
  
  try {
    // Make API request
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      console.error(`API error: ${responseCode} - ${response.getContentText()}`);
      return [];
    }
    
    const data = JSON.parse(response.getContentText());
    console.log('API Response received successfully');
    
    // Extract ads from response
    const ads = [];
    if (data.ads && data.ads.length > 0) {
      const now = new Date().toISOString();
      
      data.ads.forEach(ad => {
        // Process each ad, capturing all possible fields
        const adData = {
          keyword: keyword,
          position: ad.position || '',
          block_position: ad.block_position || '',
          relative_block_position: ad.relative_block_position || '',
          title: ad.title || '',
          tracking_link: ad.tracking_link || '',
          link: ad.link || '',
          domain: ad.domain || '',
          displayed_link: ad.displayed_link || '',
          description: ad.description || '',
          sitelinks: ad.sitelinks ? JSON.stringify(ad.sitelinks) : '',
          phone: ad.phone || '',
          location: ad.location || '',
          extensions: ad.extensions ? JSON.stringify(ad.extensions) : '',
          rich_snippet: ad.rich_snippet ? JSON.stringify(ad.rich_snippet) : '',
          scraped_at: now
        };
        
        ads.push(adData);
      });
    }
    
    return ads;
  } catch (error) {
    console.error(`Error scraping ads for keyword '${keyword}': ${error.message}`);
    return [];
  }
}

/**
 * Write ads to the Raw Scraped Ads sheet
 * 
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @param {Array} ads - Array of ad objects to write
 */
function writeAdsToSheet(spreadsheet, ads) {
  let sheet = spreadsheet.getSheetByName('Raw Scraped Ads');
  
  // Create the sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Raw Scraped Ads');
    
    // Add headers
    const headers = [
      'keyword', 'position', 'block_position', 'relative_block_position', 
      'title', 'tracking_link', 'link', 'domain', 'displayed_link', 
      'description', 'sitelinks', 'phone', 'location', 'extensions', 
      'rich_snippet', 'scraped_at'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  // Get current data (excluding header)
  let existingData = [];
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    existingData = dataRange.getValues();
  }
  
  // Prepare new data in the same order as headers
  const newData = ads.map(ad => [
    ad.keyword || '',
    ad.position || '',
    ad.block_position || '',
    ad.relative_block_position || '',
    ad.title || '',
    ad.tracking_link || '',
    ad.link || '',
    ad.domain || '',
    ad.displayed_link || '',
    ad.description || '',
    ad.sitelinks || '',
    ad.phone || '',
    ad.location || '',
    ad.extensions || '',
    ad.rich_snippet || '',
    ad.scraped_at || ''
  ]);
  
  // Combine new data at the top (below header) with existing data
  const combinedData = newData.concat(existingData);
  
  // Clear existing data and write combined data
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (combinedData.length > 0) {
    sheet.getRange(2, 1, combinedData.length, combinedData[0].length).setValues(combinedData);
  }
  
  // Auto-resize columns to fit content
  sheet.autoResizeColumns(1, combinedData[0].length);
}

/**
 * Clear all scraped data from the Raw Scraped Ads sheet
 */
function clearScrapedData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Clear Data', 'Are you sure you want to clear all scraped ads data?', ui.ButtonSet.YES_NO);
  
  if (response == ui.Button.YES) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('Raw Scraped Ads');
    
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
        ui.alert('Success', 'Scraped data has been cleared.', ui.ButtonSet.OK);
      } else {
        ui.alert('Info', 'No data to clear.', ui.ButtonSet.OK);
      }
    } else {
      ui.alert('Info', 'No "Raw Scraped Ads" sheet found.', ui.ButtonSet.OK);
    }
  }
}

/**
 * Get the value of a named range
 * 
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @param {string} rangeName - Name of the range
 * @return {string} Value of the named range
 */
function getNamedRangeValue(spreadsheet, rangeName) {
  const namedRange = spreadsheet.getRangeByName(rangeName);
  if (!namedRange) {
    console.error(`Named range '${rangeName}' not found`);
    return null;
  }
  return namedRange.getValue();
}

/**
 * Get values from a named range that contains multiple cells
 * 
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @param {string} rangeName - Name of the range
 * @return {Array} Array of values from the named range
 */
function getNamedRangeValues(spreadsheet, rangeName) {
  const namedRange = spreadsheet.getRangeByName(rangeName);
  if (!namedRange) {
    console.error(`Named range '${rangeName}' not found`);
    return [];
  }
  
  // Get all values and flatten the 2D array to 1D
  const values = namedRange.getValues();
  return values.flat().filter(val => val !== '');
} 