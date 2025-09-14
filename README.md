# This is my API powered by Cloudflare Workers
<br>

# API Documentation

This API provides endpoints to upload and download JSON data using a unique ID. Data is stored in a KV namespace with a 30-day expiration.

## Endpoints

### POST `/upload`

- **Description:** Uploads a JSON payload.
- **Headers:**  
  - `Content-Type: application/json`
- **Body:**  
  - Raw JSON (max 5 MB)
- **Response:**  
  - `{ "id": "<unique_id>" }` (JSON)

#### Errors
- `400` - Only JSON allowed / Invalid JSON
- `413` - Payload too large

---

### GET `/download/{id}`

- **Description:** Downloads the JSON payload by ID.
- **Response:**  
  - Raw JSON (as uploaded)

#### Errors
- `404` - Not found

---

## Notes

- Uploaded data expires after 30 days of inactivity.
