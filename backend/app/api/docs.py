from pathlib import Path

from flask import Blueprint, Response, send_file

docs_bp = Blueprint(
      "docs",
      __name__,
      url_prefix="/api",
  )


@docs_bp.get("/swagger.yaml")
def swagger_spec():
      swagger_path = Path(__file__).with_name("swagger.yaml")
      return send_file(
          swagger_path,
          mimetype="application/yaml",
      )


@docs_bp.get("/docs")
def swagger_ui():
      return Response(
          """
          <!doctype html>
          <html lang="pt-BR">
            <head>
              <meta charset="utf-8">
              <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
              >
              <title>Store Sales API</title>

              <link
                rel="stylesheet"
                href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
              >
            </head>

            <body>
              <div id="swagger-ui"></div>

              <script
                src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
              ></script>

              <script>
                SwaggerUIBundle({
                  url: "/api/swagger.yaml",
                  dom_id: "#swagger-ui",
                  deepLinking: true,
                  persistAuthorization: true
                });
              </script>
            </body>
          </html>
          """,
          mimetype="text/html",
      )