<?php
use Smalot\PdfParser\Parser;
use OpenAI;

class AI_Enabled_Bidding_System_Public {
    private static $plugin_name;
    private static $version;
    

    public static function init($plugin_name, $version) {
        self::$plugin_name = $plugin_name;
        self::$version = $version;

        add_action('wp_ajax_aiebs_get_user_bids', array(__CLASS__, 'get_user_bids'));
        add_action('wp_ajax_aiebs_delete_bid', array(__CLASS__, 'delete_bid'));
        add_action('wp_ajax_aiebs_update_bid_status', array(__CLASS__, 'update_bid_status'));
        add_action('wp_ajax_aiebs_update_bid', array(__CLASS__, 'update_bid'));
        add_action('wp_ajax_aiebs_ai_edit_suggestion', array(__CLASS__, 'ai_edit_suggestion'));
    }

    public static function enqueue_styles() {
        wp_enqueue_style(self::$plugin_name, plugin_dir_url(__FILE__) . '../dist/styles.css', array(), self::$version, 'all');
    }

    public static function enqueue_scripts() {
        wp_enqueue_script(self::$plugin_name, plugin_dir_url(__FILE__) . '../dist/app.js', array('wp-element'), self::$version, true);
        wp_localize_script(self::$plugin_name, 'aiebsData', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('aiebs-nonce')
        ));
    }

    public static function render_dashboard() {
        if (!is_user_logged_in()) {
            return '<div class="ai-enabled-bidding-system-error">
                        <p>You must be logged in to view the dashboard.</p>
                        <a href="' . wp_login_url(get_permalink()) . '">Login</a>
                    </div>';
        }
        return '<div id="ai-enabled-bidding-dashboard"></div>';
    }

    public static function register_user() {
        check_ajax_referer('aiebs-nonce', 'nonce');

        $username = sanitize_user($_POST['username']);
        $email = sanitize_email($_POST['email']);
        $password = $_POST['password'];

        $user_id = wp_create_user($username, $password, $email);

        if (is_wp_error($user_id)) {
            wp_send_json_error(array('message' => $user_id->get_error_message()), 400);
        } else {
            wp_send_json_success(array('message' => 'User registered successfully'));
        }
    }

    private static function extractKeyInfo($text, $fileType, $maxLength = 5000) {
        $relevantInfo = [];
    
        // Generic extraction for all file types
        $keywords = ['project', 'scope', 'budget', 'timeline', 'materials', 'labor', 'cost', 'estimate', 'price'];
        
        foreach ($keywords as $keyword) {
          if (preg_match('/\b' . $keyword . '\b.*?[:]\s*(.*?)(?=\n\n|\z)/si', $text, $matches)) {
            $relevantInfo[] = ucfirst($keyword) . ": " . trim($matches[1]);
          }
        }
    
        // File-specific extraction
        switch ($fileType) {
          case 'planSet':
            if (preg_match('/(?:floor plan|site plan|elevation).*?(?=\n\n|\z)/si', $text, $matches)) {
              $relevantInfo[] = "Plan details: " . trim($matches[0]);
            }
            break;
    
          case 'priceReferenceSheet':
            $priceInfo = [];
            if (preg_match_all('/(\w+)\s*:\s*\$?([\d,]+(?:\.\d{2})?)/i', $text, $matches, PREG_SET_ORDER)) {
              foreach ($matches as $match) {
                $priceInfo[] = "{$match[1]}: {${$match[2]}}";
              }
            }
            if (!empty($priceInfo)) {
              $relevantInfo[] = "Price information: " . implode(", ", array_slice($priceInfo, 0, 10));
            }
            break;
    
          case 'supportingDocs':
            if (preg_match('/(?:specification|requirement).*?(?=\n\n|\z)/si', $text, $matches)) {
              $relevantInfo[] = "Supporting details: " . trim($matches[0]);
            }
            break;
        }
    
        $extractedContent = implode("\n", $relevantInfo);
        return substr($extractedContent, 0, $maxLength);
    }

    public static function generate_bid() {
        try {
            check_ajax_referer('aiebs-nonce', 'nonce');
    
            // Validate required fields
            $required_fields = ['email', 'companyLocation', 'projectAddress', 'constructionField'];
            foreach ($required_fields as $field) {
                if (empty($_POST[$field])) {
                    throw new Exception("Missing required field: $field");
                }
            }
    
            // Sanitize input
            $email = sanitize_email($_POST['email']);
            $companyLocation = sanitize_text_field($_POST['companyLocation']);
            $projectAddress = sanitize_text_field($_POST['projectAddress']);
            $projectType = sanitize_text_field($_POST['projectType']);
            $constructionField = sanitize_text_field($_POST['constructionField']);
            $supportingInfo = sanitize_textarea_field($_POST['supportingInfo'] ?? '');
    
            // Handle file uploads
            $uploaded_files = array();
            $pdf_contents = array();
            $files = ['planSet', 'priceReferenceSheet', 'supportingDocs'];
            $upload_dir = wp_upload_dir();
    
            foreach ($files as $file) {
                if (!empty($_FILES[$file]['name'])) {
                    $upload_result = self::handle_file_upload($file, $upload_dir);
                    if (!is_wp_error($upload_result)) {
                        $uploaded_files[$file] = $upload_result;
                        
                        // Extract text from PDF
                        $parser = new Parser();
                        $pdf = $parser->parseFile($upload_result);
                        $fullText = $pdf->getText();
                        $pdf_contents[$file] = self::extractKeyInfo($fullText, 3000); // Increased to 3000 characters
                    } else {
                        throw new Exception("Error uploading file: " . $upload_result->get_error_message());
                    }
                }
            }
    
            // Prepare prompt for OpenAI
            $prompt = "Generate a construction bid for a {$projectType} {$constructionField} project at {$projectAddress}. ";
            $prompt .= "Company Location: {$companyLocation}. ";
            if (!empty($supportingInfo)) {
                $prompt .= "Supporting information: {$supportingInfo}. ";
            }
            
            // Include summarized PDF contents in the prompt
            foreach ($pdf_contents as $file => $content) {
                $prompt .= "Key information extracted from the provided {$file} document: {$content}\n\n";
            }
    
            $prompt .= "Please provide the following in your response:
                        1. Project Name
                        2. Location
                        3. Estimated Timeframe
                        4. Project Description
                        5. At least 5 Line Items with Name, Price, Quantity, and Unit
    
                        Format your response as a JSON object with these keys: projectName, location, timeframe, description, lineItems (an array of objects).
                        DO NOT include any markdown formatting or explanation text. Respond with the JSON object only.";
    
            // OpenAI configuration
            $api_key = get_option('aiebs_api_key');
            if (!$api_key) {
                throw new Exception('OpenAI API key is not set');
            }
    
            $client = OpenAI::client($api_key);
    
            $result = $client->chat()->create([
                'model' => get_option('aiebs_model', 'gpt-4'),
                'messages' => [
                    ['role' => 'system', 'content' => 'You are an expert construction bid generator. Your task is to create detailed, accurate bids based on the information provided.'],
                    ['role' => 'user', 'content' => $prompt]
                ],
                'temperature' => floatval(get_option('aiebs_temperature', 0.7)),
                'max_tokens' => intval(get_option('aiebs_max_tokens', 1000))
            ]);
    
            $aiResponse = $result->choices[0]->message->content;
            $aiResponse = preg_replace('/```json\n|\n```/', '', $aiResponse);
            $aiResponse = trim($aiResponse);
    
            $generatedBid = json_decode($aiResponse, true);
    
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Error parsing AI response: ' . json_last_error_msg());
            }
    
            $generatedBid['email'] = $email;
            $generatedBid['companyName'] = $companyLocation;
            $generatedBid['projectType'] = $projectType;
            $generatedBid['constructionField'] = $constructionField;
            $generatedBid['createdAt'] = current_time('mysql');
    
            // Save the bid to the database
            $bid_id = self::save_bid_to_database($generatedBid, get_current_user_id());
    
            if ($bid_id) {
                $generatedBid['id'] = $bid_id;
                wp_send_json_success($generatedBid);
            } else {
                throw new Exception('Failed to save bid to database');
            }
        } catch (Exception $e) {
            error_log('Error in generate_bid: ' . $e->getMessage());
            wp_send_json_error(array('message' => 'An error occurred while generating the bid: ' . $e->getMessage()), 500);
        }
    }

    public static function save_bid() {
        check_ajax_referer('aiebs-nonce', 'nonce');
    
        $user_id = get_current_user_id();
        if (!$user_id) {
          wp_send_json_error(array('message' => 'User not logged in'), 401);
          return;
        }
    
        $bid_data = json_decode(stripslashes($_POST['bid']), true);
        if (!$bid_data) {
          wp_send_json_error(array('message' => 'Invalid bid data'), 400);
          return;
        }
    
        $bid_id = self::save_bid_to_database($bid_data, $user_id);
    
        if ($bid_id) {
          wp_send_json_success(array('message' => 'Bid saved successfully', 'bid_id' => $bid_id));
        } else {
          wp_send_json_error(array('message' => 'Failed to save bid'), 500);
        }
    }
    
    private static function save_bid_to_database($bid_data, $user_id) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'aiebs_bids';
    
        $result = $wpdb->insert(
          $table_name,
          array(
            'user_id' => $user_id,
            'company_name' => $bid_data['companyName'],
            'project_name' => $bid_data['projectName'],
            'location' => $bid_data['location'],
            'timeframe' => $bid_data['timeframe'],
            'description' => $bid_data['description'],
            'line_items' => json_encode($bid_data['lineItems']),
            'project_type' => $bid_data['projectType'],
            'construction_field' => $bid_data['constructionField'],
            'status' => 'Pending',
            'created_at' => current_time('mysql'),
          )
        );
    
        if ($result === false) {
          error_log("Database error: " . $wpdb->last_error);
          return false;
        }
    
        return $wpdb->insert_id;
    }    

    private static function fetch_user_bids($user_id) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'aiebs_bids';
    
        $bids = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM $table_name WHERE user_id = %d ORDER BY created_at DESC",
                $user_id
            ),
            ARRAY_A
        );
    
        if ($bids === null) {
            error_log("Database error in fetch_user_bids: " . $wpdb->last_error);
            throw new Exception('Failed to fetch user bids: ' . $wpdb->last_error);
        }
    
        foreach ($bids as &$bid) {
            $bid['lineItems'] = json_decode($bid['line_items'], true);
            unset($bid['line_items']);
        }
    
        return $bids;
    }

    public static function activate() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'aiebs_bids';
        $charset_collate = $wpdb->get_charset_collate();
    
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            company_name varchar(255) NOT NULL,
            project_name varchar(255) NOT NULL,
            location text NOT NULL,
            timeframe varchar(255) NOT NULL,
            description text NOT NULL,
            line_items longtext NOT NULL,
            project_type varchar(50) NOT NULL,
            construction_field varchar(255) NOT NULL,
            status varchar(50) NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id)
        ) $charset_collate;";
    
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);

        // Set the current database version
        update_option('aiebs_db_version', '1.1');
    
        // Check if the table was created successfully
        if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") != $table_name) {
            error_log("Failed to create table: $table_name");
        }
    }

    public static function get_user_bids() {
        check_ajax_referer('aiebs-nonce', 'nonce');
    
        $user_id = get_current_user_id();
        if (!$user_id) {
            wp_send_json_error(array('message' => 'User not logged in'), 401);
            return;
        }
    
        $bids = self::fetch_user_bids($user_id);
        wp_send_json_success($bids);
    }

    public static function delete_bid() {
        check_ajax_referer('aiebs-nonce', 'nonce');
    
        $bid_id = intval($_POST['bid_id']);
        $user_id = get_current_user_id();
    
        global $wpdb;
        $table_name = $wpdb->prefix . 'aiebs_bids';
    
        $result = $wpdb->delete(
            $table_name,
            array(
                'id' => $bid_id,
                'user_id' => $user_id
            ),
            array('%d', '%d')
        );
    
        if ($result === false) {
            wp_send_json_error(array('message' => 'Failed to delete bid'));
        } else {
            wp_send_json_success(array('message' => 'Bid deleted successfully'));
        }
    }

    public static function update_bid_status() {
        check_ajax_referer('aiebs-nonce', 'nonce');
    
        $bid_id = intval($_POST['bid_id']);
        $status = sanitize_text_field($_POST['status']);
        $user_id = get_current_user_id();
    
        global $wpdb;
        $table_name = $wpdb->prefix . 'aiebs_bids';
    
        $result = $wpdb->update(
            $table_name,
            array('status' => $status),
            array('id' => $bid_id, 'user_id' => $user_id),
            array('%s'),
            array('%d', '%d')
        );
    
        if ($result === false) {
            wp_send_json_error(array('message' => 'Failed to update bid status'));
        } else {
            wp_send_json_success(array('message' => 'Bid status updated successfully'));
        }
    }

    public static function update_bid() {
        check_ajax_referer('aiebs-nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id) {
            wp_send_json_error(array('message' => 'User not logged in'), 401);
            return;
        }

        $bid_data = json_decode(stripslashes($_POST['bid']), true);
        if (!$bid_data) {
            wp_send_json_error(array('message' => 'Invalid bid data'), 400);
            return;
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'aiebs_bids';

        $result = $wpdb->update(
            $table_name,
            array(
                'project_name' => $bid_data['project_name'],
                'location' => $bid_data['location'],
                'timeframe' => $bid_data['timeframe'],
                'description' => $bid_data['description'],
                'line_items' => json_encode($bid_data['lineItems']),
                'project_type' => $bid_data['project_type'],
                'construction_field' => $bid_data['construction_field'],
            ),
            array('id' => $bid_data['id'], 'user_id' => $user_id),
            array('%s', '%s', '%s', '%s', '%s', '%s', '%s'),
            array('%d', '%d')
        );

        if ($result === false) {
            wp_send_json_error(array('message' => 'Failed to update bid'), 500);
        } else {
            wp_send_json_success(array('message' => 'Bid updated successfully'));
        }
    }

    public static function ai_edit_suggestion() {
        check_ajax_referer('aiebs-nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id) {
            wp_send_json_error(array('message' => 'User not logged in'), 401);
            return;
        }

        $bid_id = intval($_POST['bid_id']);
        $message = sanitize_textarea_field($_POST['message']);

        global $wpdb;
        $table_name = $wpdb->prefix . 'aiebs_bids';
        $bid = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table_name WHERE id = %d AND user_id = %d", $bid_id, $user_id), ARRAY_A);

        if (!$bid) {
            wp_send_json_error(array('message' => 'Bid not found'), 404);
            return;
        }

        $api_key = get_option('aiebs_api_key');
        if (!$api_key) {
            wp_send_json_error(array('message' => 'OpenAI API key is not set'), 500);
            return;
        }

        $client = OpenAI::client($api_key);

        $prompt = "You are an AI assistant helping with construction bid editing. Here's the current bid information:\n\n";
        $prompt .= "Project Name: " . $bid['project_name'] . "\n";
        $prompt .= "Description: " . $bid['description'] . "\n";
        $prompt .= "Timeframe: " . $bid['timeframe'] . "\n";
        $prompt .= "Line Items: " . $bid['line_items'] . "\n\n";
        $prompt .= "User's request: " . $message . "\n\n";
        $prompt .= "Please provide suggestions to improve this bid based on the user's request. If appropriate, include specific changes to the bid details.";

        try {
            $result = $client->chat()->create([
                'model' => get_option('aiebs_model', 'gpt-4'),
                'messages' => [
                    ['role' => 'system', 'content' => 'You are an expert construction bid editor. Your task is to provide helpful suggestions to improve bids based on user requests.'],
                    ['role' => 'user', 'content' => $prompt]
                ],
                'temperature' => floatval(get_option('aiebs_temperature', 0.7)),
                'max_tokens' => intval(get_option('aiebs_max_tokens', 1000))
            ]);

            $suggestion = $result->choices[0]->message->content;

            wp_send_json_success(array('suggestion' => $suggestion));
        } catch (Exception $e) {
            wp_send_json_error(array('message' => 'Error generating AI suggestion: ' . $e->getMessage()), 500);
        }
    }

    private static function handle_file_upload($file_key, $upload_dir) {
        if (empty($_FILES[$file_key]['name'])) {
            return new WP_Error('file_not_provided', "No file provided for $file_key");
        }
    
        $file = $_FILES[$file_key];
        $file_name = sanitize_file_name($file['name']);
        $target_path = $upload_dir['path'] . '/' . $file_name;
    
        // Check file size (100MB limit)
        if ($file['size'] > 100 * 1024 * 1024) {
            return new WP_Error('file_too_large', "File $file_key exceeds 100MB limit");
        }
    
        // Check file type (allow only PDF)
        $allowed_types = array('application/pdf');
        if (!in_array($file['type'], $allowed_types)) {
            return new WP_Error('invalid_file_type', "Invalid file type for $file_key. Only PDF is allowed.");
        }
    
        if (move_uploaded_file($file['tmp_name'], $target_path)) {
            return $target_path;
        } else {
            return new WP_Error('upload_failed', "Failed to upload file $file_key");
        }
    }

    public static function update_db_check() {
        if (get_site_option('aiebs_db_version') != '1.1') {
            self::activate();
        }
    }

    /**
     * Fallback implementation of idn_to_ascii if the Intl extension is not available
     */
    public static function idn_to_ascii_fallback($domain) {
        $parts = explode('.', $domain);
        foreach ($parts as &$part) {
            if (preg_match('/[^\x20-\x7E]/', $part)) {
                $part = 'xn--' . self::punycode_encode($part);
            }
        }
        return implode('.', $parts);
    }

    /**
     * Punycode encoding implementation
     */
    private static function punycode_encode($input) {
        $n = 0x80;
        $delta = 0;
        $bias = 72;
        $output = '';
        $input_length = mb_strlen($input, 'UTF-8');
        $handled = 0;
        
        for ($i = 0; $i < $input_length; ++$i) {
            $chr = mb_substr($input, $i, 1, 'UTF-8');
            if (preg_match('/[\x00-\x7F]/', $chr)) {
                ++$handled;
                $output .= $chr;
            }
        }
        
        $basic_length = $handled;
        if ($basic_length < $input_length) {
            $output .= '-';
        }
        
        $index = 0;
        while ($handled < $input_length) {
            $m = PHP_INT_MAX;
            for ($i = 0; $i < $input_length; ++$i) {
                $chr = mb_substr($input, $i, 1, 'UTF-8');
                $code = self::utf8_to_unicode($chr);
                if ($code >= $n && $code < $m) {
                    $m = $code;
                }
            }
            $delta += ($m - $n) * ($handled + 1);
            $n = $m;
            for ($i = 0; $i < $input_length; ++$i) {
                $chr = mb_substr($input, $i, 1, 'UTF-8');
                $code = self::utf8_to_unicode($chr);
                if ($code < $n) {
                    ++$delta;
                } elseif ($code == $n) {
                    $q = $delta;
                    for ($k = 36;; $k += 36) {
                        $t = ($k <= $bias) ? 1 : (($k >= $bias + 26) ? 26 : ($k - $bias));
                        if ($q < $t) {
                            break;
                        }
                        $output .= chr(self::digit_to_base36($t + ($q - $t) % (36 - $t)));
                        $q = ($q - $t) / (36 - $t);
                    }
                    $output .= chr(self::digit_to_base36($q));
                    $bias = self::adapt($delta, $handled + 1, ($handled == $basic_length));
                    $delta = 0;
                    ++$handled;
                }
            }
            ++$delta;
            ++$n;
        }
        return $output;
    }

    private static function utf8_to_unicode($chr) {
        $ord = ord($chr);
        if ($ord < 128) return $ord;
        if ($ord < 224) return (($ord - 192) * 64) + (ord(substr($chr, 1)) - 128);
        if ($ord < 240) return (($ord - 224) * 4096) + ((ord(substr($chr, 1)) - 128) * 64) + (ord(substr($chr, 2)) - 128);
        return (($ord - 240) * 262144) + ((ord(substr($chr, 1)) - 128) * 4096) + ((ord(substr($chr, 2)) - 128) * 64) + (ord(substr($chr, 3)) - 128);
    }

    private static function adapt($delta, $numpoints, $firsttime) {
        $delta = $firsttime ? $delta / 700 : $delta / 2;
        $delta += $delta / $numpoints;
        $k = 0;
        while ($delta > 455) {
            $delta /= 35;
            $k += 36;
        }
        return $k + (36 * $delta) / ($delta + 38);
    }

    private static function digit_to_base36($digit) {
        return $digit < 26 ? $digit + 97 : $digit + 22;
    }
}