<?php
error_reporting(E_ERROR | E_PARSE);
session_start();

$authUrl = 'http://orbitar.local/oauth2/authorize';
$tokenUrl = 'http://api.orbitar.local/api/v1/oauth2/token';
$feedUrl = 'http://api.orbitar.local/api/v1/feed/watch';

$clientId = getenv('CLIENT_ID');
$clientSecret = getenv('CLIENT_SECRET');

$redirectUrl = urlencode('http://localhost:8088/callback');
//$scope = urlencode('openid, feed, feed:all, feed:posts, feed:sorting, feed:subscriptions, feed:watch, invite, invite:check, invite:create, invite:delete, invite:list, invite:regenerate, invite:use, notifications, notifications:hide, notifications:hide:all, notifications:list, notifications:read, notifications:read:all, notifications:subscribe, post, post:bookmark, post:comment, post:create, post:edit, post:edit-comment, post:get, post:get-comment, post:get-public-key, post:history, post:preview, post:read, post:translate, post:watch, search, site, site:create, site:list, site:subscribe, site:subscriptions, status, user, user:comments, user:karma, user:posts, user:profile, user:restrictions, user:save-public-key, user:savebio, user:savegender, user:savename, user:suggest-username, vote, vote:list, vote:set');
$scope = 'feed';
$action = $_REQUEST['action'] ?? 'start';

function postRequest($url, $params, $accessToken = '', $refreshToken = '') {
    global $clientId;
    global $clientSecret;

    $ch = curl_init($url);

    // Set cURL options
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));

    if ($accessToken) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
        ]);
    }

    if ($refreshToken) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Basic ' . base64_encode($clientId . ':' . hash('sha256', $clientSecret))
        ]);
    }

    try {
        $response = json_decode(curl_exec($ch), true);
    } catch (Exception $e) {
        return [
            'error' => $e->getMessage()
        ];
    }
    return $response;
}

switch ($action) {
    default:
    case '/start':
        $state = bin2hex(random_bytes(64));
        $_SESSION['state'] = $state;
        $authorizationRedirectUrl = "$authUrl?response_type=code&client_id=$clientId&redirect_uri=$redirectUrl&scope=$scope&state=$state";
        header('Location: ' . $authorizationRedirectUrl);
        exit;

    case '/test':
        $accessToken = $_SESSION['accessToken'] ?? null;
        $response = postRequest($feedUrl, [], $_SESSION['accessToken']);
        if ($response['result'] === 'error') {
            print "Error getting feed: " . $response['message'];

            if ($response['message'] === 'Authorization token is invalid: jwt expired') {
                ?>
                Access token expired. <a href="/refresh">Refresh token</a>.
                <?php
                exit;
            }
        }
        print '<textarea style="width: 100%; height: 1000px;">' . print_r($response, true) . '</textarea>';
        break;

    case '/refresh':
        $response = postRequest($tokenUrl, [
            'refresh_token' => hash('sha256', $_SESSION['refreshToken']),
            'grant_type' => 'refresh_token'
        ], null, $_SESSION['refreshToken']);

        $_SESSION['accessToken'] = $response['payload']['token']['access_token'];
        ?>

        Новый access token: <?php print $_SESSION['accessToken'];?><br>
        <a href="/test">проверить</a>

        <?php

        break;

    case '/callback':
        $code = $_REQUEST['code'] ?? null;
        $state = $_REQUEST['state'] ?? null;
        $savedState = $_SESSION['state'] ?? null;
        if (!$code || !$state || !$savedState || $state !== $savedState) {
            echo 'Invalid state or code';
            exit;
        }
        $params = [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'grant_type' => 'authorization_code',
            'code' => hash('sha256', $code),
            'redirect_url' => urldecode($redirectUrl),
            'nonce' => bin2hex(random_bytes(32))
        ];

        $response = postRequest($tokenUrl, $params, null, null);
        if ($response['result'] === 'success') {
            $_SESSION['accessToken'] = $response['payload']['token']['access_token'];
            $_SESSION['refreshToken'] = $response['payload']['token']['refresh_token'];
        } else {
            print "Error getting token: " . print_r($response, true);
            exit;
        }

        ?>
        <style>
            div {
                margin-bottom: 20px;
            }

            textarea {
                width: 100%;
                height: 200px;
            }
        </style>
        <h1>Авторизация прошла успешно.</h1>
        <div>
            <h2>access token</h2>
            <textarea><?php print $_SESSION['accessToken'];?></textarea>
        </div>
        <div>
            <h2>refresh token:</h2>
            <textarea><?php print $_SESSION['refreshToken'];?></textarea>
        </div>
        <div>
            <a href="http://orbitar.local/profile/apps">Перейти назад к приложениям</a> |
            <a href="/test">Протестировать токены</a> |
        </div>
        <?php
        break;
}
exit;
