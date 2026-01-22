import fs from 'fs';
import path from 'path';

const CSV_PATH = 'D:\\Dev\\projects\\employee-feedback\\OCSSS_dataset.csv';
const COMPANY_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SURVEY_ID = '22222222-2222-2222-2222-222222222222'; // Deterministic ID for idempotency

function parseCSVLine(text: string) {
    const result = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cell.trim());
            cell = '';
        } else {
            cell += char;
        }
    }
    result.push(cell.trim());
    return result;
}

function generateSQL() {
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    // Handle multi-line quotes crudely if necessary, but assuming mostly single line for now or simple splits
    // actually the sample showed multi-line: "САНАЛ САНААЧИЛГА\n",

    // A better split for CSV with newlines inside quotes
    // We'll iterate char by char to split lines
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < fileContent.length; i++) {
        const char = fileContent[i];
        if (char === '"') inQuotes = !inQuotes;

        if (char === '\n' && !inQuotes) {
            lines.push(currentLine);
            currentLine = '';
        } else {
            currentLine += char;
        }
    }
    if (currentLine) lines.push(currentLine);

    let bucketedSQL = `
    -- Create Survey
    INSERT INTO surveys (id, title, description, company_id, status, created_by)
    VALUES ('${SURVEY_ID}', 'OCSSS Survey 2024', 'Organizational Culture and Employee Satisfaction Survey', '${COMPANY_ID}', 'active', '${USER_ID}')
    ON CONFLICT (id) DO NOTHING;
    
    DELETE FROM survey_questions WHERE survey_id = '${SURVEY_ID}';
  `;

    let currentSection = 'General';
    let sectionOrder = 0;
    let questionOrder = 0;

    for (const line of lines) {
        if (!line.trim()) continue;

        const parts = parseCSVLine(line);
        const col1 = parts[0]?.replace(/^"|"$/g, '').trim(); // Remove surrounding quotes if any left
        const col2 = parts[1]?.replace(/^"|"$/g, '').trim();

        if (!col1 && !col2) continue;

        // Check if it's a section header
        // Heuristic: Col1 has text but no dot (implies code), and maybe Col 2 is empty
        // OR Col 1 ends with comma in original string? No, we parsed it.
        // Looking at "МАНЛАЙЛАЛ," -> Col1="МАНЛАЙЛАЛ", Col2=""

        const isQuestionCode = /^\d+\.Q\d+$/.test(col1) || /^[A-Z]+\.Q\d+$/.test(col1) || /^Group$/.test(col1) || /^Years$/.test(col1) || /^BirthYear$/.test(col1) || /^Gender$/.test(col1) || /^\d+\.Q\d+$/.test(col1);

        if (!isQuestionCode && col1 && col1.length > 2) {
            // Likely a section
            // Special case for "1.Q1" - that matches isQuestionCode
            // Case: "МАНЛАЙЛАЛ"
            currentSection = col1;
            sectionOrder++;
            continue;
        }

        if (isQuestionCode) {
            const code = col1;
            let text = col2;

            // Determine type
            let type = 'scale'; // Default to Likert 1-5
            let options = 'null';

            // Special handling for demographics at the end
            if (['Group', 'Years', 'BirthYear', 'Gender'].includes(code)) {
                type = 'text'; // or single_choice if we had options, but CSV doesn't show them clearly
            }

            // Special handling for NPS
            if (currentSection.includes('NPS') || code.startsWith('6.Q') || code.startsWith('7.Q')) {
                type = 'scale'; // 1-10 usually? But schema says 1-5. Let's assume scale is fine.
            }

            // Escape single quotes for SQL
            text = text.replace(/'/g, "''");
            currentSection = currentSection.replace(/'/g, "''");

            bucketedSQL += `
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('${SURVEY_ID}', '${code}', '${text}', '${type}', '${currentSection}', ${sectionOrder}, ${questionOrder++}, ${options});
      `;
        }
    }

    fs.writeFileSync('scripts/survey.sql', bucketedSQL);
    console.log('SQL saved to scripts/survey.sql');
}

generateSQL();
