<?php
// Orbitar OAuth2 Client Example in PHP
// This demonstrates the complete OAuth2 flow for a simple PHP application

// Start or resume session
session_start();

// Configuration
$config = [
    // Replace with your client credentials
    'client_id' => 'YOUR_CLIENT_ID',
    'client_secret' => 'YOUR_CLIENT_SECRET',
    
    // Application settings
    'scope' => 'status',
    'redirect_uri' => 'http://localhost:3000/callback.php',
    
    // This would be your Initial Authorization URL in the client app settings
    // In a real application, you would set this to http://localhost:3000/start
    // when registering your OAuth2 client on Orbitar
    'initial_auth_url' => 'http://localhost:3000/start.php',
    
    // Orbitar endpoints
    'authorization_endpoint' => 'https://orbitar.local/oauth2/authorize',
    'token_endpoint' => 'https://api.orbitar.local/api/v1/oauth2/token',
    'api_endpoint' => 'https://api.orbitar.local/api/v1/status'
];

// For development only - disable SSL verification
$ssl_options = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ],
];

// Helper function to generate random string
function generateRandomString($length = 16) {
    return bin2hex(random_bytes($length));
}

// Helper function to make API requests with cURL
function makeRequest($url, $method = 'GET', $headers = [], $data = null, $contentType = 'application/json') {
    global $ssl_options;
    
    $curl = curl_init();
    
    // Set common options
    curl_setopt_array($curl, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_SSL_VERIFYPEER => 0, // For development only!
    ]);
    
    // Set headers
    if (!empty($headers)) {
        curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
    }
    
    // Set data for POST/PUT
    if ($method !== 'GET' && $data !== null) {
        if ($contentType === 'application/json') {
            curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($data));
        } else if ($contentType === 'application/x-www-form-urlencoded') {
            curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($data));
        }
    }
    
    // Execute request
    $response = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    
    if (curl_errno($curl)) {
        $error = curl_error($curl);
        curl_close($curl);
        throw new Exception("cURL Error: " . $error);
    }
    
    curl_close($curl);
    
    return [
        'status' => $status,
        'body' => json_decode($response, true)
    ];
}

// Helper function to refresh tokens
function refreshTokens() {
    global $config;
    
    if (!isset($_SESSION['tokens']) || !isset($_SESSION['tokens']['refresh_token'])) {
        throw new Exception('No refresh token available');
    }
    
    $refreshToken = $_SESSION['tokens']['refresh_token'];
    
    $headers = [
        'Content-Type: application/x-www-form-urlencoded',
        'Authorization: Bearer ' . $refreshToken
    ];
    
    $data = [
        'grant_type' => 'refresh_token'
    ];
    
    $response = makeRequest(
        $config['token_endpoint'],
        'POST',
        $headers,
        $data,
        'application/x-www-form-urlencoded'
    );
    
    if ($response['status'] !== 200) {
        throw new Exception('Failed to refresh token: ' . json_encode($response['body']));
    }
    
    // Update tokens in session
    $_SESSION['tokens'] = [
        'access_token' => $response['body']['access_token'],
        'refresh_token' => $response['body']['refresh_token'],
        'scope' => $response['body']['scope']
    ];
    
    return $_SESSION['tokens'];
}

// Get current path to determine which page to show
$current_page = basename($_SERVER['PHP_SELF']);

// Handle different pages
switch ($current_page) {
    // Home page
    case 'index.php':
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <title>Orbitar OAuth2 Client Example (PHP)</title>
        </head>
        <body>
            <h1>Orbitar OAuth2 Client Example (PHP)</h1>
            <p>This app demonstrates the OAuth2 flow for Orbitar.</p>
            
            <?php if (isset($_SESSION['tokens'])): ?>
                <p><strong>You are authenticated!</strong></p>
                <button onclick="location.href='status.php'">Check Status</button>
                <button onclick="location.href='logout.php'">Logout</button>
            <?php else: ?>
                <p>You can start the OAuth2 flow in two ways:</p>
                <button onclick="location.href='login.php'">Authorize with Orbitar</button>
                <button onclick="location.href='start.php'">Use Initial Authorization URL</button>
            <?php endif; ?>
        </body>
        </html>
        <?php
        break;
        
    // Login page - redirect to authorization endpoint
    case 'login.php':
        // Generate and store a state parameter to prevent CSRF
        $state = generateRandomString();
        $_SESSION['oauth_state'] = $state;
        
        // Build authorization URL
        $authUrl = $config['authorization_endpoint'] . '?' . http_build_query([
            'client_id' => $config['client_id'],
            'redirect_uri' => $config['redirect_uri'],
            'scope' => $config['scope'],
            'state' => $state
        ]);
        
        // Redirect to authorization endpoint
        header('Location: ' . $authUrl);
        exit;
        
    // Initial Authorization URL endpoint - simulates the "Start" button in app cards    
    case 'start.php':
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <title>Initial Authorization URL</title>
        </head>
        <body>
            <h1>Initial Authorization URL</h1>
            <p>This page simulates the landing page that users would see after clicking 
            the "Start" button on your embedded app card.</p>
            <p>From here, you would typically:</p>
            <ul>
                <li>Show information about your application</li>
                <li>Track analytics data about the visit</li>
                <li>Add custom parameters or state to the flow</li>
            </ul>
            
            <button onclick="location.href='initiate-auth.php'">Continue to Authorization</button>
        </body>
        </html>
        <?php
        break;
        
    // Initiate authorization from the initial page    
    case 'initiate-auth.php':
        // Generate and store a state parameter to prevent CSRF
        $state = generateRandomString();
        $_SESSION['oauth_state'] = $state;
        
        // Build authorization URL
        $authUrl = $config['authorization_endpoint'] . '?' . http_build_query([
            'client_id' => $config['client_id'],
            'redirect_uri' => $config['redirect_uri'],
            'scope' => $config['scope'],
            'state' => $state
        ]);
        
        // Redirect to authorization endpoint
        header('Location: ' . $authUrl);
        exit;
    
    // OAuth2 callback handler    
    case 'callback.php':
        $code = $_GET['code'] ?? null;
        $state = $_GET['state'] ?? null;
        
        // Verify state parameter to prevent CSRF
        if (!$state || $state !== $_SESSION['oauth_state']) {
            http_response_code(403);
            echo "State validation failed";
            exit;
        }
        
        try {
            // Exchange authorization code for tokens
            $basicAuth = base64_encode($config['client_id'] . ':' . $config['client_secret']);
            
            $headers = [
                'Content-Type: application/x-www-form-urlencoded',
                'Authorization: Basic ' . $basicAuth
            ];
            
            $data = [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => $config['redirect_uri'],
                'nonce' => generateRandomString()
            ];
            
            $response = makeRequest(
                $config['token_endpoint'],
                'POST',
                $headers,
                $data,
                'application/x-www-form-urlencoded'
            );
            
            if ($response['status'] !== 200) {
                throw new Exception('Failed to exchange code for tokens: ' . json_encode($response['body']));
            }
            
            // Store tokens in session
            $_SESSION['tokens'] = [
                'access_token' => $response['body']['access_token'],
                'refresh_token' => $response['body']['refresh_token'],
                'scope' => $response['body']['scope']
            ];
            
            // Redirect to home page
            header('Location: index.php');
            exit;
            
        } catch (Exception $e) {
            http_response_code(500);
            echo "Error during authorization: " . $e->getMessage();
            exit;
        }
    
    // Status page - call API with access token    
    case 'status.php':
        // Check if user is authenticated
        if (!isset($_SESSION['tokens'])) {
            header('Location: login.php');
            exit;
        }
        
        try {
            // Call API with access token
            $headers = [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $_SESSION['tokens']['access_token']
            ];
            
            $response = makeRequest(
                $config['api_endpoint'],
                'POST',
                $headers,
                []
            );
            
            // Check if token needs to be refreshed (401 Unauthorized)
            if ($response['status'] === 401) {
                try {
                    // Refresh tokens
                    refreshTokens();
                    
                    // Retry with new access token
                    $headers = [
                        'Content-Type: application/json',
                        'Authorization: Bearer ' . $_SESSION['tokens']['access_token']
                    ];
                    
                    $response = makeRequest(
                        $config['api_endpoint'],
                        'POST',
                        $headers,
                        []
                    );
                    
                } catch (Exception $e) {
                    // If refresh fails, redirect to login
                    unset($_SESSION['tokens']);
                    header('Location: login.php');
                    exit;
                }
            }
            
            // Display API response
            ?>
            <!DOCTYPE html>
            <html>
            <head>
                <title>API Status</title>
            </head>
            <body>
                <h1>API Status</h1>
                <pre><?php echo json_encode($response['body'], JSON_PRETTY_PRINT); ?></pre>
                <button onclick="location.href='index.php'">Back to Home</button>
            </body>
            </html>
            <?php
            
        } catch (Exception $e) {
            http_response_code(500);
            echo "Error calling API: " . $e->getMessage();
            exit;
        }
        break;
    
    // Logout page    
    case 'logout.php':
        // Remove tokens from session
        unset($_SESSION['tokens']);
        
        // Redirect to home page
        header('Location: index.php');
        exit;
        
    default:
        // If none of the specific pages, redirect to home
        header('Location: index.php');
        exit;
}
?>