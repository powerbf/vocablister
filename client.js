$("#inputs").submit(function( event ) {
    $("#results").html("");
    $.ajax({
        type: "Post",
        url: "",
        async: true,
        contentType: "application/json",
        //data: $('#inputs').serialize(),
        data: JSON.stringify(form2object()),
        success: function(response) {
            //console.log(response);
            response = JSON.parse(response);
            var output = "";
            if (response.error != null) {
                output = "<b>ERROR:</b> " + response.error;
            }
            else
            {
                let results = response.results;
                output = "<table class='table table-bordered'>";
                output += "<thead><th>Word</th><th>Freq</th><th>Meaning</th></thead>";
                for (let i = 0; i < results.length; i++) {
                    output += "<tr>";
                    let entry = results[i];
                    output += "<td>" + entry.source + "</td>"
                    output += "<td>" + entry.freq + "</td>"
                    output += "<td>" + entry.target + "</td>"
                    output += "</tr>";
                }
                output += "</table>"
            }
            $("#results").html(output);
        }
    });

    // prevent default form submit
    return false;
})

function form2object() {
    var result = {};
    result["source_lang"] = $("#source_lang").val();
    result["target_lang"] = $("#target_lang").val();
    result["freqThreshold"] = $('#freqThreshold').val();
    result["show_all"] = $('#show_all').is(":checked")
    result["text"] = $('textarea#data').val();
    return result;
}


// enable tooltips
$(function () {
  $('[data-bs-toggle="tooltip"]').tooltip()
})

//populateSelectors();



