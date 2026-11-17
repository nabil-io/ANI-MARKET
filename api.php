<?php
/**
 * ANI MARKET - API Mode Direct (PHP 7.4+)
 * Cahier des charges v2.0
 */

declare(strict_types=1);

// Configuration des sessions sécurisées (12h = 43200 secondes)
$session_lifetime = 43200;
ini_set('session.gc_maxlifetime', (string)$session_lifetime);
ini_set('session.use_only_cookies', '1');
ini_set('session.use_strict_mode', '1');

$is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

session_set_cookie_params([
    'lifetime' => $session_lifetime,
    'path'     => '/',
    'secure'   => $is_https,
    'httponly' => true,
    'samesite' => 'Strict',
]);

// Headers de réponse par défaut
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

$data_dir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$secret_file = $data_dir . DIRECTORY_SEPARATOR . 'secret.php';
$catalog_file = $data_dir . DIRECTORY_SEPARATOR . 'catalog.json';
$attempts_file = $data_dir . DIRECTORY_SEPARATOR . '.login_attempts.json';
$uploads_dir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads';

if (!is_dir($data_dir)) {
    @mkdir($data_dir, 0755, true);
}
if (!is_dir($uploads_dir)) {
    @mkdir($uploads_dir, 0755, true);
}

// Helpers
function send_json(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function has_secret_code(string $secret_file): bool {
    if (!file_exists($secret_file)) return false;
    $content = file_get_contents($secret_file);
    if (!$content) return false;
    // Supprimer l'en-tête PHP '<?php exit; ?>'
    $json = preg_replace('/^<\?php\s+exit;\s*\?>/s', '', $content);
    $data = json_decode(trim($json), true);
    return !empty($data['hash']);
}

function get_secret_data(string $secret_file): ?array {
    if (!file_exists($secret_file)) return null;
    $content = file_get_contents($secret_file);
    if (!$content) return null;
    $json = preg_replace('/^<\?php\s+exit;\s*\?>/s', '', $content);
    return json_decode(trim($json), true);
}

function save_secret_data(string $secret_file, array $data): bool {
    $content = "<?php exit; ?>\n" . json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($secret_file, $content, LOCK_EX) !== false;
}

function get_client_ip(): string {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) return $_SERVER['HTTP_CF_CONNECTING_IP'];
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function check_rate_limit(string $attempts_file): bool {
    $ip = get_client_ip();
    $now = time();
    $attempts = [];
    if (file_exists($attempts_file)) {
        $attempts = json_decode(file_get_contents($attempts_file), true) ?: [];
    }

    if (isset($attempts[$ip])) {
        $info = $attempts[$ip];
        if ($info['count'] >= 5) {
            if ($now - $info['last_attempt'] < 900) { // 15 min lockout
                return false;
            } else {
                unset($attempts[$ip]);
            }
        }
    }
    return true;
}

function record_failed_attempt(string $attempts_file): int {
    $ip = get_client_ip();
    $now = time();
    $attempts = [];
    if (file_exists($attempts_file)) {
        $attempts = json_decode(file_get_contents($attempts_file), true) ?: [];
    }
    if (!isset($attempts[$ip]) || ($now - $attempts[$ip]['last_attempt'] >= 900)) {
        $attempts[$ip] = ['count' => 1, 'last_attempt' => $now];
    } else {
        $attempts[$ip]['count']++;
        $attempts[$ip]['last_attempt'] = $now;
    }
    file_put_contents($attempts_file, json_encode($attempts), LOCK_EX);
    return $attempts[$ip]['count'];
}

function clear_failed_attempts(string $attempts_file): void {
    $ip = get_client_ip();
    if (file_exists($attempts_file)) {
        $attempts = json_decode(file_get_contents($attempts_file), true) ?: [];
        if (isset($attempts[$ip])) {
            unset($attempts[$ip]);
            file_put_contents($attempts_file, json_encode($attempts), LOCK_EX);
        }
    }
}

function is_authenticated(): bool {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['admin_logged']) || $_SESSION['admin_logged'] !== true) {
        return false;
    }
    if (empty($_SESSION['login_time']) || (time() - $_SESSION['login_time'] > 43200)) {
        $_SESSION = [];
        session_destroy();
        return false;
    }
    return true;
}

function verify_write_access(): void {
    if (!is_authenticated()) {
        send_json(401, ['ok' => false, 'error' => 'unauthorized', 'message' => 'Session expirée ou non autorisé']);
    }
    // Vérification de sécurité X-Requested-With ou Origin
    $req_with = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    
    // Si l'origine est présente, s'assurer qu'elle correspond à l'hôte
    if ($origin) {
        $parsed = parse_url($origin);
        if (!empty($parsed['host']) && $parsed['host'] !== $host && !empty($host)) {
            send_json(403, ['ok' => false, 'error' => 'forbidden', 'message' => 'Origine de requête non autorisée']);
        }
    }
}

function atomic_save_catalog(string $catalog_file, array $data, ?int $expected_version = null): int {
    $fp = fopen($catalog_file, 'c+');
    if (!$fp) {
        throw new RuntimeException("Impossible d'ouvrir le fichier catalogue");
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        throw new RuntimeException("Impossible de verrouiller le fichier catalogue");
    }

    $current_raw = stream_get_contents($fp);
    $current_data = json_decode($current_raw, true) ?: [];
    $current_version = (int)($current_data['version'] ?? 1);

    if ($expected_version !== null && $expected_version !== $current_version) {
        flock($fp, LOCK_UN);
        fclose($fp);
        send_json(409, [
            'ok' => false,
            'error' => 'conflict',
            'message' => 'Le catalogue a changé, rechargez',
            'current_version' => $current_version
        ]);
    }

    $new_version = $current_version + 1;
    $data['version'] = $new_version;

    // Écriture dans un fichier temporaire puis renommage atomique
    $tmp_file = $catalog_file . '.tmp.' . bin2hex(random_bytes(4));
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (file_put_contents($tmp_file, $json, LOCK_EX) === false) {
        flock($fp, LOCK_UN);
        fclose($fp);
        throw new RuntimeException("Échec de l'écriture du fichier temporaire");
    }

    if (!rename($tmp_file, $catalog_file)) {
        @unlink($tmp_file);
        flock($fp, LOCK_UN);
        fclose($fp);
        throw new RuntimeException("Échec du renommage du fichier catalogue");
    }

    flock($fp, LOCK_UN);
    fclose($fp);
    return $new_version;
}

// Router
$action = $_GET['r'] ?? '';
if (!$action) {
    // Si méthode GET sur la racine api.php -> ping par défaut
    $action = ($_SERVER['REQUEST_METHOD'] === 'GET') ? 'ping' : '';
}

switch ($action) {
    case 'ping':
        $has_code = has_secret_code($secret_file);
        send_json(200, [
            'ok' => true,
            'mode' => 'direct',
            'has_code' => $has_code,
            'time' => time()
        ]);
        break;

    case 'setup':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
        if (has_secret_code($secret_file)) {
            send_json(403, ['ok' => false, 'error' => 'already_configured', 'message' => 'Le code d\'accès a déjà été configuré']);
        }
        $input = get_json_input();
        $code = trim($input['code'] ?? '');
        if (mb_strlen($code) < 8) {
            send_json(400, ['ok' => false, 'error' => 'code_too_short', 'message' => 'Le code doit contenir au moins 8 caractères']);
        }
        $hash = password_hash($code, PASSWORD_DEFAULT);
        $secret_data = [
            'hash' => $hash,
            'created_at' => date('c'),
            'updated_at' => date('c')
        ];
        if (!save_secret_data($secret_file, $secret_data)) {
            send_json(500, ['ok' => false, 'error' => 'write_error', 'message' => 'Impossible d\'écrire les identifiants']);
        }
        // Démarrer la session automatiquement après le premier setup
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        session_regenerate_id(true);
        $_SESSION['admin_logged'] = true;
        $_SESSION['login_time'] = time();
        send_json(200, ['ok' => true, 'message' => 'Code configuré et session ouverte']);
        break;

    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
        if (!check_rate_limit($attempts_file)) {
            send_json(429, ['ok' => false, 'error' => 'too_many_attempts', 'message' => 'Trop d\'essais infructueux. Réessayez dans 15 minutes.']);
        }
        $secret = get_secret_data($secret_file);
        if (!$secret || empty($secret['hash'])) {
            send_json(400, ['ok' => false, 'error' => 'setup_needed', 'message' => 'Configuration du code requise']);
        }
        $input = get_json_input();
        $code = trim($input['code'] ?? '');
        if (!password_verify($code, $secret['hash'])) {
            $failed_count = record_failed_attempt($attempts_file);
            $remaining = max(0, 5 - $failed_count);
            send_json(401, [
                'ok' => false,
                'error' => 'invalid_code',
                'message' => $remaining > 0 ? "Code incorrect ($remaining essai(s) restant(s))" : 'Compte temporairement bloqué (15 min)'
            ]);
        }
        clear_failed_attempts($attempts_file);
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        session_regenerate_id(true);
        $_SESSION['admin_logged'] = true;
        $_SESSION['login_time'] = time();
        send_json(200, ['ok' => true, 'message' => 'Connexion réussie']);
        break;

    case 'logout':
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        send_json(200, ['ok' => true, 'message' => 'Déconnexion effectuée']);
        break;

    case 'session':
        if (is_authenticated()) {
            send_json(200, ['ok' => true, 'logged' => true, 'expires_in' => 43200 - (time() - $_SESSION['login_time'])]);
        } else {
            send_json(401, ['ok' => false, 'logged' => false]);
        }
        break;

    case 'catalog_admin':
        verify_write_access();
        if (!file_exists($catalog_file)) {
            send_json(404, ['ok' => false, 'error' => 'not_found', 'message' => 'Catalogue introuvable']);
        }
        $raw = file_get_contents($catalog_file);
        $data = json_decode($raw, true) ?: [];
        send_json(200, ['ok' => true, 'catalog' => $data]);
        break;

    case 'product_save':
        verify_write_access();
        $input = get_json_input();
        $product = $input['product'] ?? null;
        $expected_version = isset($input['version']) ? (int)$input['version'] : null;

        if (!is_array($product) || empty($product['name'])) {
            send_json(400, ['ok' => false, 'error' => 'invalid_data', 'message' => 'Nom du produit requis']);
        }

        $raw = file_get_contents($catalog_file);
        $catalog = json_decode($raw, true) ?: ['version' => 1, 'settings' => [], 'categories' => [], 'products' => []];

        $now = date('c');
        $pid = trim($product['id'] ?? '');
        $is_new = empty($pid);

        if ($is_new) {
            $pid = 'p_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 4);
            $product['id'] = $pid;
            $product['createdAt'] = $now;
        }
        $product['updatedAt'] = $now;
        $product['name'] = mb_substr(trim($product['name']), 0, 200);
        $product['categoryId'] = trim($product['categoryId'] ?? '');
        $product['price'] = max(0, (int)($product['price'] ?? 0));
        $product['unit'] = mb_substr(trim($product['unit'] ?? ''), 0, 50);
        $product['description'] = mb_substr(trim($product['description'] ?? ''), 0, 2000);
        $product['available'] = (bool)($product['available'] ?? true);
        $product['badge'] = in_array($product['badge'] ?? '', ['new', 'popular', 'soldout', '']) ? ($product['badge'] ?? '') : '';
        $product['hidden'] = (bool)($product['hidden'] ?? false);
        $product['images'] = is_array($product['images'] ?? null) ? array_slice($product['images'], 0, 4) : [];

        $found = false;
        if (!isset($catalog['products']) || !is_array($catalog['products'])) {
            $catalog['products'] = [];
        }
        foreach ($catalog['products'] as $k => $item) {
            if ($item['id'] === $pid) {
                $catalog['products'][$k] = $product;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $catalog['products'][] = $product;
        }

        try {
            $new_version = atomic_save_catalog($catalog_file, $catalog, $expected_version);
            send_json(200, ['ok' => true, 'product' => $product, 'version' => $new_version]);
        } catch (Exception $e) {
            send_json(500, ['ok' => false, 'error' => 'save_failed', 'message' => $e->getMessage()]);
        }
        break;

    case 'product_delete':
        verify_write_access();
        $input = get_json_input();
        $pid = trim($input['id'] ?? '');
        $expected_version = isset($input['version']) ? (int)$input['version'] : null;

        if (!$pid) send_json(400, ['ok' => false, 'error' => 'id_required']);

        $raw = file_get_contents($catalog_file);
        $catalog = json_decode($raw, true) ?: [];
        $products = $catalog['products'] ?? [];
        $filtered = [];
        $found = false;
        foreach ($products as $p) {
            if ($p['id'] === $pid) {
                $found = true;
            } else {
                $filtered[] = $p;
            }
        }
        if (!$found) {
            send_json(404, ['ok' => false, 'error' => 'not_found', 'message' => 'Produit introuvable']);
        }
        $catalog['products'] = $filtered;
        try {
            $new_version = atomic_save_catalog($catalog_file, $catalog, $expected_version);
            send_json(200, ['ok' => true, 'version' => $new_version]);
        } catch (Exception $e) {
            send_json(500, ['ok' => false, 'error' => 'delete_failed', 'message' => $e->getMessage()]);
        }
        break;

    case 'categories_save':
        verify_write_access();
        $input = get_json_input();
        $categories = $input['categories'] ?? null;
        $expected_version = isset($input['version']) ? (int)$input['version'] : null;

        if (!is_array($categories)) {
            send_json(400, ['ok' => false, 'error' => 'invalid_categories']);
        }

        $raw = file_get_contents($catalog_file);
        $catalog = json_decode($raw, true) ?: [];
        $catalog['categories'] = $categories;

        try {
            $new_version = atomic_save_catalog($catalog_file, $catalog, $expected_version);
            send_json(200, ['ok' => true, 'version' => $new_version]);
        } catch (Exception $e) {
            send_json(500, ['ok' => false, 'error' => 'save_failed', 'message' => $e->getMessage()]);
        }
        break;

    case 'settings_save':
        verify_write_access();
        $input = get_json_input();
        $settings = $input['settings'] ?? null;
        $expected_version = isset($input['version']) ? (int)$input['version'] : null;

        if (!is_array($settings)) {
            send_json(400, ['ok' => false, 'error' => 'invalid_settings']);
        }

        $raw = file_get_contents($catalog_file);
        $catalog = json_decode($raw, true) ?: [];
        $catalog['settings'] = array_merge($catalog['settings'] ?? [], $settings);

        try {
            $new_version = atomic_save_catalog($catalog_file, $catalog, $expected_version);
            send_json(200, ['ok' => true, 'version' => $new_version]);
        } catch (Exception $e) {
            send_json(500, ['ok' => false, 'error' => 'save_failed', 'message' => $e->getMessage()]);
        }
        break;

    case 'upload':
        verify_write_access();
        if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            send_json(400, ['ok' => false, 'error' => 'no_file', 'message' => 'Aucun fichier reçu ou erreur d\'envoi']);
        }
        $file = $_FILES['image'];
        if ($file['size'] > 1048576) { // 1 Mo max
            send_json(400, ['ok' => false, 'error' => 'file_too_large', 'message' => 'Fichier supérieur à 1 Mo']);
        }

        $info = @getimagesize($file['tmp_name']);
        if (!$info) {
            send_json(400, ['ok' => false, 'error' => 'not_an_image', 'message' => 'Fichier non reconnu comme une image']);
        }

        $mime = $info['mime'] ?? '';
        $ext = '';
        if ($mime === 'image/jpeg') $ext = 'jpg';
        elseif ($mime === 'image/png') $ext = 'png';
        elseif ($mime === 'image/webp') $ext = 'webp';
        else {
            send_json(400, ['ok' => false, 'error' => 'unsupported_format', 'message' => 'Format accepté : JPEG, PNG ou WebP']);
        }

        $unique_name = 'img_' . bin2hex(random_bytes(6)) . '.' . $ext;
        $dest_path = $uploads_dir . DIRECTORY_SEPARATOR . $unique_name;

        if (!move_uploaded_file($file['tmp_name'], $dest_path)) {
            send_json(500, ['ok' => false, 'error' => 'upload_failed', 'message' => 'Impossible d\'enregistrer le fichier']);
        }

        send_json(200, [
            'ok' => true,
            'path' => 'uploads/' . $unique_name,
            'size' => filesize($dest_path)
        ]);
        break;

    case 'change_code':
        verify_write_access();
        $input = get_json_input();
        $old_code = trim($input['old_code'] ?? '');
        $new_code = trim($input['new_code'] ?? '');

        if (mb_strlen($new_code) < 8) {
            send_json(400, ['ok' => false, 'error' => 'code_too_short', 'message' => 'Le nouveau code doit contenir au moins 8 caractères']);
        }

        $secret = get_secret_data($secret_file);
        if (!$secret || empty($secret['hash']) || !password_verify($old_code, $secret['hash'])) {
            send_json(403, ['ok' => false, 'error' => 'invalid_old_code', 'message' => 'L\'ancien code d\'accès est incorrect']);
        }

        $secret['hash'] = password_hash($new_code, PASSWORD_DEFAULT);
        $secret['updated_at'] = date('c');

        if (!save_secret_data($secret_file, $secret)) {
            send_json(500, ['ok' => false, 'error' => 'write_error', 'message' => 'Erreur lors de la mise à jour du code']);
        }

        send_json(200, ['ok' => true, 'message' => 'Code d\'accès modifié avec succès']);
        break;

    default:
        send_json(404, ['ok' => false, 'error' => 'unknown_route', 'message' => 'Route API inconnue']);
        break;
}
