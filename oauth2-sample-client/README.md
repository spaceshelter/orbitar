# Sample OAuth2 Client Documentation

This document provides instructions for setting up and using a sample OAuth2 client.

## How to Use

### Prerequisites

Ensure you have Docker installed on your system.

### Configuration Steps

1. Modify the `docker-compose.yml` file:
   - Replace `192.168.1.72` with the IP address of your host machine.
   - If necessary, change the default Nginx port, which is set to `8088`.

2. Application Registration:
   - Navigate to http://orbitar.local and log in.
   - In your profile, find and click on the `Приложения` submenu.
   - Register a new application with the following details:
      - Name: `Test`
      - Description: Enter a description between 32 and 255 characters.
      - Allowed Redirect URLs: `http://localhost:8080/*`
      - Initial Authorization Endpoint: `http://localhost:8088/start`

3. Configuration:
   - Enter your `client_id` and `client_secret` in the `.env` file.

### Running the Application

Execute the following command to start the application:

```bash
docker-compose up -d
```
