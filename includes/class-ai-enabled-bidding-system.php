<?php
class AI_Enabled_Bidding_System {
    protected $loader;
    protected $plugin_name;
    protected $version;

    public function __construct() {
        $this->version = AIEBS_VERSION;
        $this->plugin_name = 'ai-enabled-bidding-system';
        $this->load_dependencies();
        $this->define_admin_hooks();
        $this->define_public_hooks();
    }

    private function load_dependencies() {
        $this->loader = new AI_Enabled_Bidding_System_Loader();
    }

    private function define_admin_hooks() {
        $plugin_admin = new AI_Enabled_Bidding_System_Admin($this->get_plugin_name(), $this->get_version());
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_styles');
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_scripts');
    }

    private function define_public_hooks() {
        AI_Enabled_Bidding_System_Public::init($this->get_plugin_name(), $this->get_version());
        $this->loader->add_action('wp_enqueue_scripts', 'AI_Enabled_Bidding_System_Public', 'enqueue_styles');
        $this->loader->add_action('wp_enqueue_scripts', 'AI_Enabled_Bidding_System_Public', 'enqueue_scripts');
    }

    public function run() {
        $this->loader->run();
    }

    public function get_plugin_name() {
        return $this->plugin_name;
    }

    public function get_loader() {
        return $this->loader;
    }

    public function get_version() {
        return $this->version;
    }
}