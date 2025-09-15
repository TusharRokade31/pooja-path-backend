import express from 'express';
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Load environment variables
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_ADMIN_KEY = process.env.SHOPIFY_ADMIN_KEY;

app.post('/upload', (req, res) => {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "Form parse error", details: err });
    }

    try {
      const file = files.resume;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Read file and convert to Base64
      const fileBuffer = fs.readFileSync(file.filepath);
      const fileBase64 = fileBuffer.toString("base64");

      // Upload to Shopify Files API
      const uploadResponse = await fetch(
        `https://${SHOPIFY_SHOP}/admin/api/2024-10/files.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ADMIN_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: {
              attachment: fileBase64,
              filename: file.originalFilename,
              content_type: file.mimetype,
            },
          }),
        }
      );

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        return res.status(500).json({
          error: "File upload failed",
          details: uploadData,
        });
      }

      const fileUrl = uploadData.file.public_url || uploadData.file.url;

      // Save URL in customer metafield
      const customerId = fields.customer_id;
      if (customerId) {
        const metafieldResponse = await fetch(
          `https://${SHOPIFY_SHOP}/admin/api/2024-10/customers/${customerId}/metafields.json`,
          {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_ADMIN_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              metafield: {
                namespace: "job_application",
                key: "cv_link",
                value: fileUrl,
                type: "single_line_text_field",
              },
            }),
          }
        );

        const metafieldData = await metafieldResponse.json();
        if (!metafieldResponse.ok) {
          console.warn("Metafield save failed:", metafieldData);
        }
      }

      return res.status(200).json({
        success: true,
        url: fileUrl,
        message: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ error: "Server error", details: error.message });
    }
  });
});

app.use(cors())

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

});
