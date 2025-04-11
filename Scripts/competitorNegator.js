// ------------------------------
// USER CONFIGURATION SECTION
// ------------------------------

// Make a copy of this Google Sheet and paste the URL of your copy in between the single quotes below 'https://docs.google.com/spreadsheets/d/1gf8mj1aTU3FfYm4DspKmHHjxz3-WYlF8sIMH1Jy7QSs/edit?usp=sharing'

// Enter your Google Sheet URL here between the single quotes
const SHEET_URL = '';

// Enter the name of the sheet/tab where you want the data to be exported
const TAB_NAME = 'Raw Data';

// Enter your GAQL query here
function getGAQLQuery(lookback) {
  return `
  SELECT 
    search_term_view.search_term, 
    search_term_view.status, 
    campaign.name,
    metrics.impressions, 
    metrics.clicks, 
    metrics.cost_micros, 
    metrics.conversions
  FROM 
    search_term_view
  WHERE
    segments.date DURING ${lookback}
    AND metrics.impressions > 0
    AND campaign.advertising_channel_type = "SEARCH"
`;
}

function getLocationsToCheck(ss) {
  Logger.log('Getting location lists to check based on Control Centre settings');
  let locationsToCheck = [];
  
  // Get checkbox values from Control Centre
  const checkboxes = {
    'use_england': 'england_locations',
    'use_scotland': 'scotland_locations',
    'use_wales': 'wales_locations',
    'use_northern_ireland': 'northern_ireland_locations',
    'use_broad': 'broad_locations'
  };
  
  // Check each checkbox and add corresponding locations if checked
  for (const [checkbox, locationRange] of Object.entries(checkboxes)) {
    try {
      const isChecked = ss.getRangeByName(checkbox).getValue();
      if (isChecked) {
        Logger.log(`${checkbox} is checked, adding ${locationRange} to location check list`);
        const locations = ss.getRangeByName(locationRange).getValues().flat().filter(Boolean);
        locationsToCheck = locationsToCheck.concat(locations);
      }
    } catch (error) {
      Logger.log(`Error getting ${checkbox} or ${locationRange}: ${error}`);
    }
  }
  
  Logger.log(`Total locations to check: ${locationsToCheck.length}`);
  return locationsToCheck;
}

function containsLocation(searchTerm, locations) {
  // Convert search term to lowercase for case-insensitive comparison
  const termWords = searchTerm.toLowerCase().trim().split(/\s+/);
  
  // Only check two-word terms
  if (termWords.length !== 2) return false;
  
  // Check if either word matches any location
  return termWords.some(word => 
    locations.some(location => 
      word === location.toString().toLowerCase().trim()
    )
  );
}

function getSkipLists(ss) {
  Logger.log('Getting skip lists from named ranges');
  try {
    // Get minor locations (always used)
    const minorLocations = ss.getRangeByName('minor_locations')
      .getValues()
      .flat()
      .filter(Boolean)
      .map(loc => loc.toString().toLowerCase().trim());
    Logger.log(`Loaded ${minorLocations.length} minor locations`);

    // Get reserved words
    const reservedWords = ss.getRangeByName('reserved_words')
      .getValues()
      .flat()
      .filter(Boolean)
      .map(word => word.toString().toLowerCase().trim());
    Logger.log(`Loaded ${reservedWords.length} reserved words`);

    // Get leading words
    const leadingWords = ss.getRangeByName('leading_words')
      .getValues()
      .flat()
      .filter(Boolean)
      .map(word => word.toString().toLowerCase().trim());
    Logger.log(`Loaded ${leadingWords.length} leading words`);

    return { minorLocations, reservedWords, leadingWords };
  } catch (error) {
    Logger.log(`Error loading skip lists: ${error}`);
    throw error;
  }
}

function shouldSkipTerm(searchTerm, skipLists) {
  // Added validation to handle digit-only search terms
  if (!searchTerm || typeof searchTerm !== 'string') {
    return {
      skip: true,
      reason: 'Invalid search term'
    };
  }

  const termLower = searchTerm.toLowerCase().trim();
  const words = termLower.split(/\s+/);
  
  // Check for reserved words anywhere in the term
  for (const word of words) {
    if (skipLists.reservedWords.includes(word)) {
      return {
        skip: true,
        reason: `Contains reserved word: ${word}`
      };
    }
  }
  
  // Check if term starts with any leading words
  if (skipLists.leadingWords.includes(words[0])) {
    return {
      skip: true,
      reason: `Starts with: ${words[0]}`
    };
  }
  
  // For two-word terms, check minor locations
  if (words.length === 2) {
    for (const word of words) {
      if (skipLists.minorLocations.includes(word)) {
        return {
          skip: true,
          reason: `Contains minor location: ${word}`
        };
      }
    }
  }
  
  return {
    skip: false,
    reason: ''
  };
}

function checkCompetitor(searchTerm, locations, skipLists) {
  // Input validation
  if (!searchTerm || typeof searchTerm !== 'string') {
    Logger.log(`Invalid search term received: ${JSON.stringify(searchTerm)}`);
    return {
      count: 0,
      url: '',
      reason: 'Invalid search term'
    };
  }

  // Check skip lists first
  const skipCheck = shouldSkipTerm(searchTerm, skipLists);
  if (skipCheck.skip) {
    Logger.log(`Skipping search term: "${searchTerm}" - ${skipCheck.reason}`);
    return {
      count: 0,
      url: '',
      reason: skipCheck.reason
    };
  }

  // Check if it's a two-word term containing a location
  if (containsLocation(searchTerm, locations)) {
    Logger.log(`Skipping search term with location: "${searchTerm}"`);
    return {
      count: 0,
      url: '',
      reason: 'Contains location'
    };
  }

  Logger.log(`Checking competitor status for search term: "${searchTerm}"`);
  
  const baseUrl = 'https://find-and-update.company-information.service.gov.uk/advanced-search/get-results';
  const params = {
    'companyNameIncludes': searchTerm,
    'companyNameExcludes': '',
    'registeredOfficeAddress': ''
  };
  
  // Build URL with parameters
  const url = baseUrl + '?' + Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  Logger.log(`Making request to Companies House URL: ${url}`);
    
  try {
    const response = UrlFetchApp.fetch(url);
    const content = response.getContentText();
    Logger.log('Successfully received response from Companies House');
    
    // Extract number of results using regex
    const resultsMatch = content.match(/<p class="govuk-heading-m">(\d+) result/);
    if (resultsMatch) {
      const count = parseInt(resultsMatch[1], 10);
      Logger.log(`Found ${count} results for "${searchTerm}"`);
      return {
        count: count,
        url: url
      };
    }
    Logger.log(`No results found for "${searchTerm}"`);
    return {
      count: 0,
      url: ''
    };
  } catch (error) {
    Logger.log(`Error checking competitor for "${searchTerm}": ${error}`);
    Logger.log(`Error stack: ${error.stack}`);
    return {
      count: -1,
      url: ''
    };
  }
}

function main() {
  Logger.log('Starting competitor check script');
  
  Logger.log(`Opening spreadsheet: ${SHEET_URL}`);
  let ss = SpreadsheetApp.openByUrl(SHEET_URL);  
  let sheet = ss.getSheetByName(TAB_NAME);  
  Logger.log(`Accessed sheet: ${TAB_NAME}`);
  
  // Get locations and skip lists
  const locations = getLocationsToCheck(ss);
  const skipLists = getSkipLists(ss);
  
  // Get the lookback period from the named range
  let lookback = 'LAST_7_DAYS'; // Default value
  try {
    lookback = ss.getRangeByName('lookback').getValue();
    Logger.log(`Using lookback period from named range: ${lookback}`);
  } catch (error) {
    Logger.log(`Error getting lookback period from named range: ${error}. Using default: ${lookback}`);
  }
  
  // Run the GAQL query
  Logger.log('Executing GAQL query to fetch search terms');
  let query = AdsApp.report(getGAQLQuery(lookback));
  query.exportToSheet(sheet);
  Logger.log('Successfully exported GAQL query results to sheet');
  
  // Get the data range
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  Logger.log(`Retrieved ${data.length - 1} rows of data to process`);
  
  // Add new columns if they don't exist
  const competitorColIndex = headers.indexOf('Is Competitor');
  const urlColIndex = headers.indexOf('Companies House URL');
  const reasonColIndex = headers.indexOf('Skip Reason');
  
  Logger.log('Checking and adding required columns');
  if (competitorColIndex === -1) {
    sheet.getRange(1, headers.length + 1).setValue('Is Competitor');
    Logger.log('Added "Is Competitor" column');
  }
  if (urlColIndex === -1) {
    sheet.getRange(1, headers.length + (competitorColIndex === -1 ? 2 : 1)).setValue('Companies House URL');
    Logger.log('Added "Companies House URL" column');
  }
  if (reasonColIndex === -1) {
    sheet.getRange(1, headers.length + (competitorColIndex === -1 ? 3 : 2)).setValue('Skip Reason');
    Logger.log('Added "Skip Reason" column');
  }
  
  Logger.log('Beginning to process search terms');
  let processedCount = 0;
  let competitorCount = 0;
  let skippedCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const searchTerm = data[i][0];
    Logger.log(`Processing row ${i} of ${data.length - 1}: "${searchTerm}" (type: ${typeof searchTerm})`);
    
    if (!searchTerm || typeof searchTerm !== 'string') {
      Logger.log(`Warning: Invalid search term at row ${i}: ${JSON.stringify(searchTerm)}`);
      continue;
    }
    
    const results = checkCompetitor(searchTerm, locations, skipLists);
    
    // Calculate column positions
    const finalCompetitorCol = competitorColIndex !== -1 ? competitorColIndex + 1 : headers.length + 1;
    const finalUrlCol = urlColIndex !== -1 ? urlColIndex + 1 : headers.length + (competitorColIndex === -1 ? 2 : 1);
    const finalReasonCol = reasonColIndex !== -1 ? reasonColIndex + 1 : headers.length + (competitorColIndex === -1 ? 3 : 2);
    
    // Write results to sheet
    const isCompetitor = results.count > 0;
    sheet.getRange(i + 1, finalCompetitorCol).setValue(isCompetitor ? 'Yes' : 'No');
    sheet.getRange(i + 1, finalUrlCol).setValue(isCompetitor ? results.url : '');
    sheet.getRange(i + 1, finalReasonCol).setValue(results.reason || '');
    
    processedCount++;
    if (isCompetitor) competitorCount++;
    if (results.reason) skippedCount++;
    
    // Log progress every 10 terms or at the end
    if (processedCount % 10 === 0 || i === data.length - 1) {
      Logger.log(`Progress: ${processedCount}/${data.length - 1} terms processed. Found ${competitorCount} competitors so far. Skipped ${skippedCount} terms.`);
    }
  }
  
  Logger.log(`Script completed. Processed ${processedCount} search terms:`);
  Logger.log(`- Found ${competitorCount} competitors`);
  Logger.log(`- Skipped ${skippedCount} terms`);
}

// Enhancements To Do - before companies house check:
// - Ignore three-word search terms where one of the words is a location and the other is a reserved or leading word e.g. "london roof company" or "london roofing specialist" or "north london roofing"
// - Add search terms with special characters, such as &, to the competitor list by default.