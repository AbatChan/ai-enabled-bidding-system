<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
    <form action="options.php" method="post">
        <?php
        settings_fields('ai_bidding_settings');
        do_settings_sections('ai_bidding_settings');
        ?>
        <table class="form-table">
            <tr>
                <th scope="row"><label for="aiebs_api_key">API Key</label></th>
                <td><input type="text" id="aiebs_api_key" name="aiebs_api_key" value="<?php echo esc_attr(get_option('aiebs_api_key')); ?>" class="regular-text"></td>
            </tr>
            <tr>
                <th scope="row"><label for="aiebs_model">Model</label></th>
                <td>
                    <select id="aiebs_model" name="aiebs_model">
                        <option value="gpt-3.5-turbo" <?php selected(get_option('aiebs_model'), 'gpt-3.5-turbo'); ?>>GPT-3.5 Turbo</option>
                        <option value="gpt-4" <?php selected(get_option('aiebs_model'), 'gpt-4'); ?>>GPT-4</option>
                        <option value="gpt-4-turbo" <?php selected(get_option('aiebs_model'), 'gpt-4-turbo'); ?>>GPT-4 Turbo</option>
                        <option value="gpt-4o" <?php selected(get_option('aiebs_model'), 'gpt-4o'); ?>>GPT-4o</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="aiebs_max_tokens">Max Tokens</label></th>
                <td><input type="number" id="aiebs_max_tokens" name="aiebs_max_tokens" value="<?php echo esc_attr(get_option('aiebs_max_tokens', 1000)); ?>" class="small-text"></td>
            </tr>
            <tr>
                <th scope="row"><label for="aiebs_temperature">Temperature</label></th>
                <td><input type="number" id="aiebs_temperature" name="aiebs_temperature" value="<?php echo esc_attr(get_option('aiebs_temperature', 0.7)); ?>" step="0.1" min="0" max="1" class="small-text"></td>
            </tr>
            <tr>
                <th scope="row"><label for="aiebs_dashboard_slug">Dashboard Slug</label></th>
                <td>
                    <input type="text" id="aiebs_dashboard_slug" name="aiebs_dashboard_slug" value="<?php echo esc_attr(get_option('aiebs_dashboard_slug', 'bidding-dashboard')); ?>" class="regular-text">
                    <p class="description">Enter the slug for the page where your bidding dashboard is located.</p>
                </td>
            </tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>