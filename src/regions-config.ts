// Business Regions Configuration
// Customize this file to match your organization's regional structure

export const BUSINESS_REGIONS = {
  'EMEA': {
    name: 'Europe, Middle East & Africa',
    color: '#3498db',
    countries: [
      // Europe
      'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark',
      'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland',
      'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Norway',
      'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland',
      'United Kingdom', 'Albania', 'Andorra', 'Belarus', 'Bosnia and Herzegovina', 'Moldova',
      'Monaco', 'Montenegro', 'North Macedonia', 'San Marino', 'Serbia', 'Ukraine', 'Vatican',
      // Middle East
      'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Kuwait', 'Bahrain', 'Israel',
      'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Iran', 'Yemen', 'Turkey', 'Armenia', 'Azerbaijan',
      'Georgia',
      // Africa
      'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon',
      'Cape Verde', 'Central African Republic', 'Chad', 'Comoros', 'Democratic Republic of the Congo',
      'Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini',
      'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Kenya',
      'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius',
      'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'São Tomé and Príncipe',
      'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan',
      'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
    ]
  },
  'APAC': {
    name: 'Asia-Pacific',
    color: '#e74c3c',
    countries: [
      'Australia', 'New Zealand', 'China', 'Japan', 'South Korea', 'North Korea', 'Mongolia',
      'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Maldives', 'Afghanistan',
      'Thailand', 'Vietnam', 'Singapore', 'Malaysia', 'Indonesia', 'Philippines', 'Brunei',
      'Cambodia', 'Laos', 'Myanmar', 'Timor-Leste', 'Papua New Guinea', 'Fiji', 'Solomon Islands',
      'Vanuatu', 'Samoa', 'Tonga', 'Tuvalu', 'Kiribati', 'Nauru', 'Palau', 'Marshall Islands',
      'Micronesia', 'Taiwan', 'Hong Kong', 'Macau', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan',
      'Turkmenistan', 'Uzbekistan'
    ]
  },
  'NA': {
    name: 'North America',
    color: '#27ae60',
    countries: [
      'United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'El Salvador', 'Honduras',
      'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica', 'Haiti', 'Dominican Republic',
      'Bahamas', 'Barbados', 'Trinidad and Tobago', 'Saint Lucia', 'Saint Vincent and the Grenadines',
      'Grenada', 'Antigua and Barbuda', 'Saint Kitts and Nevis', 'Dominica'
    ]
  },
  'LATAM': {
    name: 'Latin America',
    color: '#f39c12',
    countries: [
      'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Uruguay',
      'Paraguay', 'Bolivia', 'Guyana', 'Suriname', 'French Guiana'
    ]
  },
  'OCE': {
    name: 'Oceania',
    color: '#9b59b6',
    countries: [
      'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands',
      'Vanuatu', 'Samoa', 'Tonga', 'Tuvalu', 'Kiribati', 'Nauru', 'Palau', 
      'Marshall Islands', 'Micronesia'
    ]
  }
};

// Alternative: More granular regions
export const GRANULAR_REGIONS = {
  'WE': { name: 'Western Europe', color: '#3498db', countries: ['France', 'Germany', 'United Kingdom', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Ireland', 'Portugal'] },
  'EE': { name: 'Eastern Europe', color: '#2980b9', countries: ['Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Slovakia', 'Croatia', 'Serbia', 'Ukraine', 'Belarus'] },
  'NE': { name: 'Northern Europe', color: '#85c1e9', countries: ['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland', 'Estonia', 'Latvia', 'Lithuania'] },
  'ME': { name: 'Middle East', color: '#f4d03f', countries: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Kuwait', 'Bahrain', 'Israel', 'Jordan', 'Turkey'] },
  'AF': { name: 'Africa', color: '#e67e22', countries: ['South Africa', 'Nigeria', 'Egypt', 'Kenya', 'Ghana', 'Morocco', 'Tunisia', 'Algeria', 'Angola', 'Ethiopia'] },
  'EA': { name: 'East Asia', color: '#e74c3c', countries: ['China', 'Japan', 'South Korea', 'North Korea', 'Mongolia', 'Taiwan', 'Hong Kong', 'Macau'] },
  'SEA': { name: 'Southeast Asia', color: '#c0392b', countries: ['Thailand', 'Vietnam', 'Singapore', 'Malaysia', 'Indonesia', 'Philippines', 'Brunei', 'Cambodia', 'Laos', 'Myanmar'] },
  'SA': { name: 'South Asia', color: '#f1948a', countries: ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Maldives', 'Afghanistan'] },
  'ANZ': { name: 'Australia & New Zealand', color: '#9b59b6', countries: ['Australia', 'New Zealand'] },
  'PI': { name: 'Pacific Islands', color: '#bb8fce', countries: ['Papua New Guinea', 'Fiji', 'Solomon Islands', 'Vanuatu', 'Samoa', 'Tonga', 'Tuvalu'] },
  'NA': { name: 'North America', color: '#27ae60', countries: ['United States', 'Canada'] },
  'CA': { name: 'Central America', color: '#58d68d', countries: ['Mexico', 'Guatemala', 'Belize', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama'] },
  'CAR': { name: 'Caribbean', color: '#82e5aa', countries: ['Cuba', 'Jamaica', 'Haiti', 'Dominican Republic', 'Bahamas', 'Barbados', 'Trinidad and Tobago'] },
  'SA_REGION': { name: 'South America', color: '#f39c12', countries: ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Uruguay', 'Paraguay', 'Bolivia'] }
}; 