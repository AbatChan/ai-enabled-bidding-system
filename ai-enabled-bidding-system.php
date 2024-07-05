<?php
/**
 * Plugin Name: AI Enabled Bidding System
 * Plugin URI: https://github.com/AbatChan/ai-enabled-bidding-system
 * Description: A plugin to enable AI powered bidding system.
 * Version: 1.0.0
 * Author: Abat Chan
 * Author URI: https://www.behance.net/abatchan
 * GitHub Plugin URI: https://github.com/AbatChan/ai-enabled-bidding-system
 * GitHub Branch: main
 * License: GPL-2.0-or-later
*/

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('AIEBS_VERSION', '1.0.0');
define('AIEBS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('AIEBS_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include the OpenAI PHP library
require_once AIEBS_PLUGIN_DIR . 'vendor/autoload.php';

// Include the necessary class files
require_once AIEBS_PLUGIN_DIR . 'includes/class-ai-enabled-bidding-system.php';
require_once AIEBS_PLUGIN_DIR . 'includes/class-ai-enabled-bidding-system-loader.php';
require_once AIEBS_PLUGIN_DIR . 'includes/class-ai-enabled-bidding-system-shortcode.php';
require_once AIEBS_PLUGIN_DIR . 'admin/class-ai-enabled-bidding-system-admin.php';
require_once AIEBS_PLUGIN_DIR . 'public/class-ai-enabled-bidding-system-public.php';

/**
 * Begin execution of the plugin.
 */
function run_ai_enabled_bidding_system() {
    $plugin = new AI_Enabled_Bidding_System();
    $plugin->run();

    new AI_Enabled_Bidding_System_Shortcode();

    $admin = new AI_Enabled_Bidding_System_Admin($plugin->get_plugin_name(), $plugin->get_version());
    // These actions are now added only once
    add_action('admin_menu', array($admin, 'add_plugin_settings_page'));
    add_action('admin_init', array($admin, 'register_settings'));

    add_action('init', function() {
        AI_Enabled_Bidding_System_Public::activate();
    });    

    // Initialize the public class
    AI_Enabled_Bidding_System_Public::init($plugin->get_plugin_name(), $plugin->get_version());
}

run_ai_enabled_bidding_system();

// Activation hook
register_activation_hook(__FILE__, array('AI_Enabled_Bidding_System_Public', 'activate'));

// Add AJAX actions
add_action('wp_ajax_aiebs_generate_bid', array('AI_Enabled_Bidding_System_Public', 'generate_bid'));
add_action('wp_ajax_nopriv_aiebs_generate_bid', array('AI_Enabled_Bidding_System_Public', 'generate_bid'));
add_action('wp_ajax_aiebs_get_user_bids', array('AI_Enabled_Bidding_System_Public', 'get_user_bids'));
add_action('wp_ajax_aiebs_delete_bid', array('AI_Enabled_Bidding_System_Public', 'delete_bid'));
add_action('wp_ajax_aiebs_update_bid_status', array('AI_Enabled_Bidding_System_Public', 'update_bid_status'));

// Enqueue scripts and styles
function aiebs_enqueue_scripts() {
    wp_enqueue_style('aiebs-styles', AIEBS_PLUGIN_URL . 'dist/styles.css', array(), AIEBS_VERSION);
    wp_enqueue_script('aiebs-app', AIEBS_PLUGIN_URL . 'dist/app.js', array('wp-element'), AIEBS_VERSION, true);
    wp_localize_script('aiebs-app', 'aiebsData', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('aiebs-nonce'),
        'siteUrl' => get_site_url(),
        'dashboardSlug' => get_option('aiebs_dashboard_slug', 'bidding-dashboard')
    ));
}
add_action('wp_enqueue_scripts', 'aiebs_enqueue_scripts');