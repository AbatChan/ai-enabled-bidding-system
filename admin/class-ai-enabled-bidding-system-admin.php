<?php
class AI_Enabled_Bidding_System_Admin {
    private $plugin_name;
    private $version;

    public function __construct($plugin_name, $version) {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
    }

    public function enqueue_styles() {
        wp_enqueue_style($this->plugin_name, plugin_dir_url(__FILE__) . 'css/ai-enabled-bidding-system-admin.css', array(), $this->version, 'all');
    }

    public function enqueue_scripts() {
        wp_enqueue_script($this->plugin_name, plugin_dir_url(__FILE__) . 'js/ai-enabled-bidding-system-admin.js', array('jquery'), $this->version, false);
    }

    public function add_plugin_settings_page() {
        add_options_page(
            'AI Enabled Bidding System Settings',
            'AI Bidding System',
            'manage_options',
            'ai-bidding-settings',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('ai_bidding_settings', 'aiebs_api_key');
        register_setting('ai_bidding_settings', 'aiebs_model');
        register_setting('ai_bidding_settings', 'aiebs_max_tokens');
        register_setting('ai_bidding_settings', 'aiebs_temperature');
        register_setting('ai_bidding_settings', 'aiebs_dashboard_slug');
    }

    public function render_settings_page() {
        require_once plugin_dir_path(dirname(__FILE__)) . 'admin/partials/ai-enabled-bidding-system-settings.php';
    }
}