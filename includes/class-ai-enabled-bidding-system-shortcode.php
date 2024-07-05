<?php
class AI_Enabled_Bidding_System_Shortcode {
    public function __construct() {
        add_shortcode('ai_bidding_form', array($this, 'render_form'));
        add_shortcode('ai_bidding_dashboard', array($this, 'render_dashboard'));
    }

    public function render_form() {
        return '<div id="ai-enabled-bidding-system"></div>';
    }

    public function render_dashboard() {
        return '<div id="ai-enabled-bidding-dashboard"></div>';
    }
}