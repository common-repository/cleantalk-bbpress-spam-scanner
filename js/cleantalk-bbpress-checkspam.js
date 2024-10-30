// Printf for JS
String.prototype.printf = function(){
    var formatted = this;
    for( var arg in arguments ) {
        var before_formatted = formatted.substring(0, formatted.indexOf("%s", 0));
        var after_formatted  = formatted.substring(formatted.indexOf("%s", 0)+2, formatted.length);
        formatted = before_formatted + arguments[arg] + after_formatted;
    }
    return formatted;
};

// Flags
var ct_working = false,
    ct_new_check = true,
    ct_cooling_down_flag = false,
    ct_close_animate = true,
    ct_accurate_check = false,
    ct_pause = false,
    ct_prev_accurate = ctBbpressCheck.ct_prev_accurate,
    ct_prev_from = ctBbpressCheck.ct_prev_from,
    ct_prev_till = ctBbpressCheck.ct_prev_till;
// Settings
var ct_cool_down_time = 90000,
    ct_requests_counter = 0,
    ct_max_requests = 60;
// Variables
var ct_ajax_nonce = ctBbpressCheck.ct_ajax_nonce,
    ct_comments_total = 0,
    ct_comments_checked = 0,
    ct_comments_spam = 0,
    ct_comments_bad = 0,
    ct_unchecked = 'unset',
    ct_date_from = 0,
    ct_date_till = 0;

function ct_clear_topics(){

    var from = 0, till = 0;

    var data = {
        'action'   : 'ajax_bbpress_scan_clear_topics',
        'security' : ct_ajax_nonce,
        'from'     : from,
        'till'     : till
    };

    jQuery.ajax({
        type: "POST",
        url: ajaxurl,
        data: data,
        success: function(msg){
            ct_show_info();
            ct_send_topics();
        }
    });
}

//Continues the check after cooldown time
//Called by ct_send_users();
function ct_cooling_down_toggle(){
    ct_cooling_down_flag = false;
    ct_send_topics();
    ct_show_info();
}

function ct_send_topics(){

    if(ct_cooling_down_flag === true)
        return;

    if(ct_requests_counter >= ct_max_requests){
        setTimeout(ct_cooling_down_toggle, ct_cool_down_time);
        ct_requests_counter = 0;
        ct_cooling_down_flag = true;
        return;
    }else{
        ct_requests_counter++;
    }

    var data = {
        'action': 'ajax_bbpress_scan_check_topics',
        'security': ct_ajax_nonce,
        'new_check': ct_new_check,
        'unchecked': ct_unchecked
    };

    if(ct_accurate_check)
        data['accurate_check'] = true;

    if(ct_date_from && ct_date_till){
        data['from'] = ct_date_from;
        data['till'] = ct_date_till;
    }

    jQuery.ajax({
        type: "POST",
        url: ajaxurl,
        data: data,
        success: function(msg){

            msg = jQuery.parseJSON(msg);

            if(parseInt(msg.error)){
                ct_working=false;
                if(!confirm(msg.error_message+". Do you want to proceed?")){
                    var new_href = 'edit-comments.php?page=ct_check_spam';
                    if(ct_date_from != 0 && ct_date_till != 0)
                        new_href+='&from='+ct_date_from+'&till='+ct_date_till;
                    location.href = new_href;
                }else
                    ct_send_topics();
            }else{
                ct_new_check = false;
                if(parseInt(msg.end) == 1 || ct_pause === true){
                    if(parseInt(msg.end) == 1)
                        document.cookie = 'ct_paused_bbPress_spam_check=0; path=/; samesite=lax';
                    ct_working=false;
                    jQuery('#ct_working_message').hide();
                    var new_href = 'edit-comments.php?page=ct_bbpress_check_spam';
                    if(ct_date_from != 0 && ct_date_till != 0)
                        new_href+='&from='+ct_date_from+'&till='+ct_date_till;
                    location.href = new_href;
                }else if(parseInt(msg.end) == 0){
                    ct_comments_checked += msg.checked;
                    ct_comments_spam += msg.spam;
                    ct_comments_bad += msg.bad;
                    ct_unchecked = ct_comments_total - ct_comments_checked - ct_comments_bad;
                    var status_string = String(ctBbpressCheck.ct_status_string);
                    var status_string = status_string.printf(ct_comments_checked, ct_comments_spam, ct_comments_bad);
                    if(parseInt(ct_comments_spam) > 0)
                        status_string += ctBbpressCheck.ct_status_string_warning;
                    jQuery('#ct_checking_status').html(status_string);
                    jQuery('#ct_error_message').hide();
                    // If DB woks not properly
                    if(+ct_comments_total < ct_comments_checked + ct_comments_bad){
                        document.cookie = 'ct_comments_start_check=1; path=/; samesite=lax';
                        document.cookie = 'ct_comments_safe_check=1; path=/; samesite=lax';
                        location.href = 'edit-comments.php?page=ct_bbpress_check_spam';
                    }
                    ct_send_topics();
                }
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            jQuery('#ct_error_message').show();
            jQuery('#cleantalk_ajax_error').html(textStatus);
            jQuery('#cleantalk_js_func').html('Check comments');
            setTimeout(ct_send_topics(), 3000);
        },
        timeout: 25000
    });
}

function ct_show_info(){

    if(ct_working){

        if(ct_cooling_down_flag == true){
            jQuery('#ct_cooling_notice').html('Waiting for API to cool down. (About a minute)');
            jQuery('#ct_cooling_notice').show();
            return;
        }else{
            jQuery('#ct_cooling_notice').hide();
        }

        if(!ct_comments_total){

            var data = {
                'action': 'ajax_bbpress_scan_info_topics',
                'security': ct_ajax_nonce
            };

            if(ct_date_from && ct_date_till){
                data['from'] = ct_date_from;
                data['till'] = ct_date_till;
            }

            jQuery.ajax({
                type: "POST",
                url: ajaxurl,
                data: data,
                success: function(msg){
                    msg = jQuery.parseJSON(msg);
                    jQuery('#ct_checking_status').html(msg.message);
                    ct_comments_total   = msg.total;
                    ct_comments_spam    = msg.spam;
                    ct_comments_checked = msg.checked;
                    ct_comments_bad     = msg.bad;
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    jQuery('#ct_error_message').show();
                    jQuery('#cleantalk_ajax_error').html(textStatus);
                    jQuery('#cleantalk_js_func').html('Check topics');
                    setTimeout(ct_show_info(), 3000);
                },
                timeout: 15000
            });
        }
    }
}

// Function to toggle dependences
function ct_toggle_depended(obj, secondary){

    secondary = secondary || null;

    var depended = jQuery(obj.data('depended')),
        state = obj.data('state');

    if(!state && !secondary){
        obj.data('state', true);
        depended.removeProp('disabled');
    }else{
        obj.data('state', false);
        depended.prop('disabled', true);
        depended.removeProp('checked');
        if(depended.data('depended'))
            ct_toggle_depended(depended, true);
    }
}

function ct_trash_all( e ) {

    var data = {
        'action': 'ajax_trash_all',
        'security': ct_ajax_nonce
    };

    jQuery('.' + e.target.id).addClass('disabled');
    jQuery('.spinner').css('visibility', 'visible');
    jQuery.ajax({
        type: "POST",
        url: ajaxurl,
        data: data,
        success: function( msg ){
            if( msg > 0 ){
                jQuery('#cleantalk_comments_left').html(msg);
                ct_trash_all( e );
            }else{
                jQuery('.' + e.target.id).removeClass('disabled');
                jQuery('.spinner').css('visibility', 'hidden');
                location.href='edit-comments.php?page=ct_bbpress_check_spam';
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            jQuery('#ct_error_message').show();
            jQuery('#cleantalk_ajax_error').html(textStatus);
            jQuery('#cleantalk_js_func').html('Check comments');
            setTimeout(ct_trash_all( e ), 3000);
        },
        timeout: 25000
    });

}

function ct_spam_all( e ) {

    var data = {
        'action': 'ajax_spam_all',
        'security': ct_ajax_nonce
    };

    jQuery('.' + e.target.id).addClass('disabled');
    jQuery('.spinner').css('visibility', 'visible');
    jQuery.ajax({
        type: "POST",
        url: ajaxurl,
        data: data,
        success: function( msg ){
            if( msg > 0 ){
                jQuery('#cleantalk_comments_left').html(msg);
                ct_spam_all( e );
            }else{
                jQuery('.' + e.target.id).removeClass('disabled');
                jQuery('.spinner').css('visibility', 'hidden');
                location.href='edit-comments.php?page=ct_bbpress_check_spam';
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            jQuery('#ct_error_message').show();
            jQuery('#cleantalk_ajax_error').html(textStatus);
            jQuery('#cleantalk_js_func').html('Check comments');
            setTimeout(ct_spam_all( e ), 3000);
        },
        timeout: 25000
    });

}

jQuery(document).ready(function(){

    // Prev check parameters
    if(ct_prev_accurate){
        jQuery("#ct_accurate_check").prop('checked', true);
    }
    if(ct_prev_from){
        jQuery("#ct_allow_date_range").prop('checked', true).data('state', true);
        jQuery("#ct_date_range_from").removeProp('disabled').val(ct_prev_from);
        jQuery("#ct_date_range_till").removeProp('disabled').val(ct_prev_till);
    }

    // Toggle dependences
    jQuery("#ct_allow_date_range").on('change', function(){
        document.cookie = 'ct_spam_dates_from='+ jQuery('#ct_date_range_from').val() +'; path=/; samesite=lax';
        document.cookie = 'ct_spam_dates_till='+ jQuery('#ct_date_range_till').val() +'; path=/; samesite=lax';
        if( this.checked ) {
            document.cookie = 'ct_spam_dates_allowed=1; path=/; samesite=lax';
            jQuery('.ct_date').prop('checked', true).removeProp('disabled');
        } else {
            document.cookie = 'ct_spam_dates_allowed=0; path=/; samesite=lax';
            jQuery('.ct_date').prop('disabled', true).removeProp('checked');
        }
    });

    jQuery.datepicker.setDefaults(jQuery.datepicker.regional['en']);
    var dates = jQuery('#ct_date_range_from, #ct_date_range_till').datepicker(
        {
            dateFormat: 'M d yy',
            maxDate:"+0D",
            changeMonth:true,
            changeYear:true,
            showAnim: 'slideDown',
            onSelect: function(selectedDate){
                var option = this.id == "ct_date_range_from" ? "minDate" : "maxDate",
                    instance = jQuery( this ).data( "datepicker" ),
                    date = jQuery.datepicker.parseDate(
                        instance.settings.dateFormat || jQuery.datepicker._defaults.dateFormat,
                        selectedDate, instance.settings);
                dates.not(this).datepicker("option", option, date);
                document.cookie = 'ct_spam_dates_from='+ jQuery('#ct_date_range_from').val() +'; path=/; samesite=lax';
                document.cookie = 'ct_spam_dates_till='+ jQuery('#ct_date_range_till').val() +'; path=/; samesite=lax';
            }
        }
    );

    function ct_start_check(continue_check){

        continue_check = continue_check || null;

        if(jQuery('#ct_allow_date_range').is(':checked')){

            ct_date_from = jQuery('#ct_date_range_from').val();
            ct_date_till = jQuery('#ct_date_range_till').val();

            if(!(ct_date_from != '' && ct_date_till != '')){
                alert('Please, specify a date range.');
                return;
            }
        }

        if(jQuery('#ct_accurate_check').is(':checked')){
            ct_accurate_check = true;
        }

        jQuery('.ct_to_hide').hide();
        jQuery('#ct_working_message').show();
        jQuery('#ct_preloader').show();
        jQuery('#ct_pause').show();

        ct_working=true;

        if(continue_check){
            ct_show_info();
            ct_send_topics();
        }else
            ct_clear_topics();

    }

    // Check comments
    jQuery("#ct_check_spam_button").click(function(){
        document.cookie = 'ct_paused_spam_check=0; path=/; samesite=lax';
        ct_start_check(false);
    });
    jQuery("#ct_proceed_check_button").click(function(){
        ct_start_check(true);
    });

    // Pause the check
    jQuery('#ct_pause').on('click', function(){
        ct_pause = true;
        var ct_check = {
            'accurate': ct_accurate_check,
            'from'    : ct_date_from,
            'till'    : ct_date_till
        };
        document.cookie = 'ct_paused_spam_check=' + JSON.stringify(ct_check) + '; path=/; samesite=lax';
    });


    if(ctBbpressCheck.start === '1'){
        document.cookie = 'ct_bbPress_spam_start_check=0; expires=' + new Date(0).toUTCString() + '; path=/; samesite=lax';
        jQuery('#ct_check_spam_button').click();
    }

    // Delete all spam comments
    jQuery(".ct_trash_all").click(function( e ){

        if (!confirm(ctBbpressCheck.ct_confirm_trash_all))
            return false;

        ct_trash_all( e );

    });

    // Mark as spam all spam comments
    jQuery(".ct_spam_all").click(function( e ){

        if (!confirm(ctBbpressCheck.ct_confirm_spam_all))
            return false;

        ct_spam_all( e );

    });

});
