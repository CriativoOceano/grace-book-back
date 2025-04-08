export function getBaseTemplate(content: string, title: string = 'Chácara da Igreja'): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #3a7d44;
            color: white;
            padding: 10px 20px;
            text-align: center;
          }
          .content {
            padding: 20px;
            background-color: #fff;
            border: 1px solid #eee;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #777;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Chácara da Igreja. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }