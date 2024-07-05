<?php
use Smalot\PdfParser\Parser;

class AI_Enabled_Bidding_System_Public {
    private static $plugin_name;
    private static $version;
    

    public static function init($plugin_name, $version) {
        self::$plugin_name = $plugin_name;
        self::$version = $version;

        add_action('wp_ajax_aiebs_get_user_bids', array(__CLASS__, 'get_user_bids'));
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

    public static function extractKeyInfo($text, $maxLength = 3000) {
        // Split the text into lines
        $lines = explode("\n", $text);
        
        // Initialize an array to store relevant information
        $relevantInfo = [];
    
        // Loop through each line
        foreach ($lines as $line) {
            // Skip the header line
            if (strpos($line, 'Classification ID') !== false) {
                continue;
            }
            
            // Extract service and price information
            if (preg_match('/^(D\d+)\s+(.+?)\s+(\$[\d,.]+)/', $line, $matches)) {
                $id = $matches[1];
                $service = $matches[2];
                $price = $matches[3];
                
                $relevantInfo[] = "{$id}: {$service} - {$price}";
            }
        }
    
        // Join the relevant information and truncate to max length
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
                    wp_send_json_error(array('message' => "Missing required field: $field"), 400);
                    return;
                }
            }

            // Sanitize input
            $email = sanitize_email($_POST['email']);
            $companyLocation = sanitize_text_field($_POST['companyLocation']);
            $projectAddress = sanitize_text_field($_POST['projectAddress']);
            $constructionField = sanitize_text_field($_POST['constructionField']);
            $supportingInfo = sanitize_textarea_field($_POST['supportingInfo'] ?? '');

            // Handle file uploads
            $uploaded_files = array();
            $pdf_contents = array();
            foreach ($files as $file) {
                if (!empty($_FILES[$file]['name'])) {
                    $upload_result = self::handle_file_upload($file, $upload_dir);
                    if (!is_wp_error($upload_result)) {
                        $uploaded_files[$file] = $upload_result;
                        
                        // Extract text from PDF
                        $parser = new Parser();
                        $pdf = $parser->parseFile($upload_result);
                        $fullText = $pdf->getText();
                        $pdf_contents[$file] = self::extractKeyInfo($fullText, 2000); // Limit to 2000 characters
                    }
                }
            }

            // Prepare prompt for OpenAI
            $prompt = "Generate a construction bid for a {$constructionField} project at {$projectAddress}. ";
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

            // Check if the Intl extension is loaded
            if (!extension_loaded('intl')) {
                // Fallback implementation
                if (!function_exists('idn_to_ascii')) {
                    function idn_to_ascii($domain, $options = 0, $variant = 0, &$idn_info = array()) {
                        return $domain; // Simple fallback, just return the original domain
                    }
                }
            }

            $client = OpenAI::client($api_key);

            $result = $client->chat()->create([
                'model' => get_option('aiebs_model', 'gpt-4o'),
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
            $generatedBid['constructionField'] = $constructionField;
            $generatedBid['createdAt'] = current_time('mysql');

            // Save the bid to the database
            $bid_id = self::save_bid_to_database($generatedBid);

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

    private static function save_bid_to_database($bid_data) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'aiebs_bids';
    
        $result = $wpdb->insert(
            $table_name,
            array(
                'user_id' => get_current_user_id(),
                'company_name' => $bid_data['companyName'],
                'project_name' => $bid_data['projectName'],
                'location' => $bid_data['location'],
                'timeframe' => $bid_data['timeframe'],
                'description' => $bid_data['description'],
                'line_items' => json_encode($bid_data['lineItems']),
                'construction_field' => $bid_data['constructionField'],
                'status' => 'Pending',
                'created_at' => current_time('mysql'),
            )
        );
    
        if ($result === false) {
            error_log("Database error: " . $wpdb->last_error);
            throw new Exception('Failed to save bid to database: ' . $wpdb->last_error);
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
            construction_field varchar(255) NOT NULL,
            status varchar(50) NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id)
        ) $charset_collate;";
    
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    
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

    private static function handle_file_upload($file_key, $upload_dir) {
        if (empty($_FILES[$file_key]['name'])) {
            return new WP_Error('file_not_provided', "No file provided for $file_key");
        }

        $file = $_FILES[$file_key];
        $file_name = sanitize_file_name($file['name']);
        $target_path = $upload_dir['path'] . '/' . $file_name;

        // Check file size (2MB limit)
        if ($file['size'] > 2 * 1024 * 1024) {
            return new WP_Error('file_too_large', "File $file_key exceeds 2MB limit");
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
}