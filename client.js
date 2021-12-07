$("#inputs").submit(function( event ) {
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
            var output = "<table class='table table-bordered'>";
            output += "<thead><th>Freq</th><th>From</th><th>To</th></thead>";
            for (let i = 0; i < response.length; i++) {
                output += "<tr>";
                let entry = response[i];
                output += "<td>" + entry.freq + "</td>"
                output += "<td>" + entry.source + "</td>"
                output += "<td>" + entry.target + "</td>"
                output += "</tr>";
            }
            output += "</table>"
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
    result["text"] = $('textarea#data').val();
    return result;
}


// enable tooltips
$(function () {
  $('[data-bs-toggle="tooltip"]').tooltip()
})

//populateSelectors();



