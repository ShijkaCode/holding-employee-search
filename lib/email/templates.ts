/**
 * Email Templates for Survey Invitations
 * Responsive HTML templates with multi-language support
 */

export interface EmailTemplateData {
  employeeName: string
  surveyTitle: string
  surveyDescription?: string
  magicLinkUrl: string
  deadline?: string
  estimatedTime?: string
  companyName: string
  locale: 'en' | 'mn'
}

/**
 * Base HTML email template with responsive design
 */
function baseTemplate(content: string, locale: 'en' | 'mn'): string {
  const year = new Date().getFullYear()
  const footerText = locale === 'mn'
    ? `© ${year} Employee Feedback System. Бүх эрх хуулиар хамгаалагдсан.`
    : `© ${year} Employee Feedback System. All rights reserved.`

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Survey Invitation</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 20px;
      color: #1a1a1a;
    }
    .message {
      font-size: 16px;
      color: #4a4a4a;
      margin-bottom: 20px;
    }
    .survey-info {
      background-color: #f9fafb;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 30px 0;
    }
    .survey-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 10px 0;
    }
    .survey-description {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
    }
    .info-item {
      font-size: 14px;
    }
    .info-label {
      color: #6b7280;
      font-weight: 500;
    }
    .info-value {
      color: #1a1a1a;
      font-weight: 600;
      margin-top: 5px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      text-align: center;
      margin: 30px 0;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .note {
      font-size: 14px;
      color: #6b7280;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px 20px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
      .survey-title {
        font-size: 18px;
      }
      .info-row {
        flex-direction: column;
        gap: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${content}
    <div class="footer">
      <p>${footerText}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Survey invitation email content (English)
 */
function invitationContentEN(data: EmailTemplateData): string {
  const { employeeName, surveyTitle, surveyDescription, magicLinkUrl, deadline, estimatedTime, companyName } = data

  return `
    <div class="header">
      <h1>📋 Survey Invitation</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${employeeName},</div>

      <div class="message">
        You have been invited to participate in a survey. Your feedback is valuable and will help us improve our workplace.
      </div>

      <div class="survey-info">
        <div class="survey-title">${surveyTitle}</div>
        ${surveyDescription ? `<p class="survey-description">${surveyDescription}</p>` : ''}

        <div class="info-row">
          ${deadline ? `
            <div class="info-item">
              <div class="info-label">Deadline</div>
              <div class="info-value">${deadline}</div>
            </div>
          ` : ''}
          ${estimatedTime ? `
            <div class="info-item">
              <div class="info-label">Estimated Time</div>
              <div class="info-value">${estimatedTime}</div>
            </div>
          ` : ''}
        </div>
      </div>

      <center>
        <a href="${magicLinkUrl}" class="cta-button">
          Start Survey
        </a>
      </center>

      <div class="note">
        <p><strong>Note:</strong> This is a secure, one-time link that will expire in 7 days. Please do not share this link with others.</p>
        <p>If you have any questions or encounter any issues, please contact your HR department.</p>
        <p>Thank you for your participation!</p>
        <p><strong>${companyName}</strong></p>
      </div>
    </div>
  `
}

/**
 * Survey invitation email content (Mongolian)
 */
function invitationContentMN(data: EmailTemplateData): string {
  const { employeeName, surveyTitle, surveyDescription, magicLinkUrl, deadline, estimatedTime, companyName } = data

  return `
    <div class="header">
      <h1>📋 Судалгааны урилга</h1>
    </div>
    <div class="content">
      <div class="greeting">Сайн байна уу ${employeeName},</div>

      <div class="message">
        Та судалгаанд оролцох урилга хүлээн авлаа. Таны санал бодол бидэнд маш чухал бөгөөд ажлын орчноо сайжруулахад тусална.
      </div>

      <div class="survey-info">
        <div class="survey-title">${surveyTitle}</div>
        ${surveyDescription ? `<p class="survey-description">${surveyDescription}</p>` : ''}

        <div class="info-row">
          ${deadline ? `
            <div class="info-item">
              <div class="info-label">Дуусах хугацаа</div>
              <div class="info-value">${deadline}</div>
            </div>
          ` : ''}
          ${estimatedTime ? `
            <div class="info-item">
              <div class="info-label">Тооцоолсон хугацаа</div>
              <div class="info-value">${estimatedTime}</div>
            </div>
          ` : ''}
        </div>
      </div>

      <center>
        <a href="${magicLinkUrl}" class="cta-button">
          Судалгаа эхлүүлэх
        </a>
      </center>

      <div class="note">
        <p><strong>Анхаар:</strong> Энэ бол аюулгүй, нэг удаагийн холбоос бөгөөд 7 хоногийн дараа дуусгавартай. Энэ холбоосыг бусадтай хуваалцахгүй байхыг хүсье.</p>
        <p>Хэрэв танд асуулт байвал эсвэл асуудал гарвал Хүний нөөцийн хэлтэстэй холбогдоно уу.</p>
        <p>Оролцсонд баярлалаа!</p>
        <p><strong>${companyName}</strong></p>
      </div>
    </div>
  `
}

/**
 * Generate survey invitation email HTML
 */
export function generateInvitationEmail(data: EmailTemplateData): string {
  const content = data.locale === 'mn'
    ? invitationContentMN(data)
    : invitationContentEN(data)

  return baseTemplate(content, data.locale)
}

/**
 * Generate reminder email HTML
 */
export function generateReminderEmail(data: EmailTemplateData): string {
  const { employeeName, surveyTitle, magicLinkUrl, deadline, companyName, locale } = data

  const contentEN = `
    <div class="header">
      <h1>⏰ Survey Reminder</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${employeeName},</div>

      <div class="message">
        This is a friendly reminder that you have a pending survey that requires your attention.
      </div>

      <div class="survey-info">
        <div class="survey-title">${surveyTitle}</div>
        ${deadline ? `
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Deadline</div>
              <div class="info-value">${deadline}</div>
            </div>
          </div>
        ` : ''}
      </div>

      <center>
        <a href="${magicLinkUrl}" class="cta-button">
          Complete Survey
        </a>
      </center>

      <div class="note">
        <p>Your feedback is important to us. Please take a moment to complete the survey at your earliest convenience.</p>
        <p>Thank you!</p>
        <p><strong>${companyName}</strong></p>
      </div>
    </div>
  `

  const contentMN = `
    <div class="header">
      <h1>⏰ Судалгааны сануулга</h1>
    </div>
    <div class="content">
      <div class="greeting">Сайн байна уу ${employeeName},</div>

      <div class="message">
        Энэ бол таны анхаарал хандуулах шаардлагатай хүлээгдэж буй судалгааны сануулга юм.
      </div>

      <div class="survey-info">
        <div class="survey-title">${surveyTitle}</div>
        ${deadline ? `
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Дуусах хугацаа</div>
              <div class="info-value">${deadline}</div>
            </div>
          </div>
        ` : ''}
      </div>

      <center>
        <a href="${magicLinkUrl}" class="cta-button">
          Судалгааг бөглөх
        </a>
      </center>

      <div class="note">
        <p>Таны санал бодол бидэнд чухал. Та боломжийн үедээ судалгааг бөглөнө үү.</p>
        <p>Баярлалаа!</p>
        <p><strong>${companyName}</strong></p>
      </div>
    </div>
  `

  const content = locale === 'mn' ? contentMN : contentEN
  return baseTemplate(content, locale)
}

/**
 * Get email subject line
 */
export function getEmailSubject(type: 'invitation' | 'reminder', surveyTitle: string, locale: 'en' | 'mn'): string {
  if (type === 'invitation') {
    return locale === 'mn'
      ? `Судалгааны урилга: ${surveyTitle}`
      : `Survey Invitation: ${surveyTitle}`
  } else {
    return locale === 'mn'
      ? `Сануулга: ${surveyTitle}`
      : `Reminder: ${surveyTitle}`
  }
}
