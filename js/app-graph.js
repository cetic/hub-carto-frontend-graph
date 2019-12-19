// global variables cleanup

if (typeof width == "undefined"){
    var width = 1200;
}
if (typeof height == "undefined"){
    var height = 800;
}
if (typeof margin == "undefined"){
    var margin = 5;
}
if (typeof pad == "undefined"){
    var pad = 6; //not used for now
}
if (typeof default_zoom == "undefined"){
    var default_zoom = 1;
}
if (typeof div_outer_graph == "undefined"){
    var div_outer_graph = d3.select("#hub-carto-graph");
}

if (typeof environment == "undefined"){
    var environment = "prod";
}

if (typeof data_addr == "undefined"){
    var data_addr= "https://carto-hub-creatif.cetic.be/data.json"; //default: CETIC backend
}

if (typeof show_timestamp == "undefined"){
    var show_timestamp = true;
}

// objects initialization and functions declaration

function zoomed() {
	vis.attr("transform", d3.event.transform);
}

var zoom = d3.zoom()
	.scaleExtent([.2, 10])
	.on("zoom", zoomed);

var outer = div_outer_graph.append("svg")
    .attr('width',width)
    .attr('height',height)
    .attr('pointer-events',"all")
    .call(zoom);

outer.append('rect')
    .attr('class','background')
    .attr('width',"100%")
    .attr('height',"100%");

var vis = outer.append('g');

zoom.scaleTo(outer, default_zoom);


var color = d3.scaleOrdinal(d3.schemePaired); //https://github.com/d3/d3-scale-chromatic

var d3cola = cola.d3adaptor(d3)
    .convergenceThreshold(0.1)
    .avoidOverlaps(true)
    .size([width, height])
    .jaccardLinkLengths(100);

function getNodeIndex(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
        if (id == nodes[i].id) return i;
    }
    return undefined;
}

//https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color
function pickTextColorBasedOnBgColorAdvanced(bgColor, lightColor, darkColor) {
    var color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
    var r = parseInt(color.substring(0, 2), 16); // hexToR
    var g = parseInt(color.substring(2, 4), 16); // hexToG
    var b = parseInt(color.substring(4, 6), 16); // hexToB
    var uicolors = [r / 255, g / 255, b / 255];
    var c = uicolors.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    var L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
    return (L > 0.179) ? darkColor : lightColor;
}

function getRadiusFromStyle(style) {
    if(style === "tag"){
        return 0
    }else if (style === "entity"){
        return 5
    }else if (style === "enterprise"){
        return 10
    }else if (style === "contact"){
        return 20
    }
}

function getDwLink(node) {
    if (node.type === "entity"){
        return "https://www.digitalwallonia.be/fr/annuaire/"+node.properties["slug"];
    }else if (node.type === "tag"){
        return "https://www.digitalwallonia.be/fr/tags/"+node.properties["slug"];
    }
}

// retrieve json data from CETIC backend.
//
// address for retrieving graph data json from CETIC backend is https://carto-hub-creatif.cetic.be/data.json
// you need to pass some parameters to select which data you want.
// here is a list of possible parameters:
//  - You need to add at least one of these parameters (you can add more than one)
//     - hub_creatif=on --> show elements related to hub_creatif
//     - living_lab=on --> show elements related to living_lab
//     - fab_lab=on --> show elements related to fab_lab
//     - espace_coworking=on --> show elements related to fab_lab
//     - creative_wallonia=on --> show elements related to fab_lab
//  - You need to specify which categories of elements to be included in the response
//     - elements=entities --> only main entities
//     - elements=enterprises --> only main entities and linked enterprises
//     - elements=contacts --> only main entities and linked contacts
//     - elements=all --> main entities + linked enterprises + linked contacts WARNING takes lot of time to refresh backend data (1x/24h)
//  - By default, only elements validated by digital wallonia will be included.
//    If you want to include also elements NOT validated by digital wallonia, you can add this parameter
//     - not_only_digital_wallonia=on

var params="";

if ((typeof request_hub_creatif !== "undefined") && (request_hub_creatif)) {
    params = params + "hub_creatif=on&";
}
if ((typeof request_living_lab !== "undefined") && (request_living_lab)) {
    params = params + "living_lab=on&";
}
if ((typeof request_fab_lab !== "undefined") && (request_fab_lab)) {
    params = params + "fab_lab=on&";
}
if ((typeof request_espace_coworking !== "undefined") && (request_espace_coworking)) {
    params = params + "espace_coworking=on&";
}
if ((typeof request_creative_wallonia !== "undefined") && (request_creative_wallonia)) {
    params = params + "creative_wallonia=on&";
}

if (typeof filter_elements !== "undefined"){
    params = params + "elements="+filter_elements+"&";
}
if ((typeof filter_not_only_digital_wallonia === "boolean") && (filter_not_only_digital_wallonia)) {
    params = params + "not_only_digital_wallonia=on&";
}

if (params.length > 1){
    data_addr = data_addr + "?" + params;
    data_addr = data_addr.substring(0, data_addr.length - 1);
}

d3.json(data_addr).then(function (graph) {
    div_outer_graph.selectAll("#waiting_div").remove()

    if (graph  === null)
    {
        return;
    }

    if (show_timestamp){
        var date = new Date(graph.date);
        var date_text = "Horodatage des données: " + date.toLocaleString();
        if (environment === "prod"){
            date_text +=  " (Durée du cache: 24 heures)";
        }else if (environment === "dev"){
            date_text +=  " (Pas de cache)";
        }
        div_outer_graph.insert("div")// div_outer_graph.insert("div",":first-child")
            .attr("class", "date_div")
            .text(function(d){
                return date_text;
            });
    }

    //replacing source and target links by their index
    graph.links.forEach(function(e) {
        e.source = getNodeIndex(graph.nodes, e.source);
        e.target = getNodeIndex(graph.nodes, e.target);
        e.colors.forEach(function(col, i) {
            if (typeof(col) == "number"){
                e.colors[i] = color(col)
            }
        });
    });

    d3cola
        .nodes(graph.nodes)
        .links(graph.links);

    var link = vis.selectAll(".link")
        .data(graph.links)
       .enter().append("svg:g");

    var max_link_colors_nbr = Math.max.apply(Math, graph.links.map(function(o) { return o.colors.length; }));

    for (var i = 1; i<=max_link_colors_nbr; i++){
        var dash_length = 20;

        for (var c = 0; c< i; c++){
            link.filter(function(d) { return d.colors.length == i })
                .append("line")
                .attr("class", "link")
                .style("stroke", function (d) { return d.colors[c]; })
                .style("stroke-dasharray", "" + dash_length + " " + dash_length*(i-1) + "")
                .style("stroke-dashoffset", "" + -dash_length*c + "")
                .style("stroke-width", function (d) { return Math.sqrt(d.value); });
        }

    }

    var max_node_colors_nbr = Math.max.apply(Math, graph.nodes.map(function(o) { return o.colors.length; }));

    var node = vis.selectAll(".node")
        .data(graph.nodes)
        .enter().each(function (d) {
            d.colors.forEach(function(col, i) {
                if (typeof(col) == "number"){
                    d.colors[i] = color(col)
                }
            });
        })
        .append("svg:g");

    //only for circle (contact)
    for (var i = 1; i<=max_node_colors_nbr; i++){
        var circle_radius = 10;

        for (var c = 0; c< i; c++){
            node.filter(function(d) { return d.colors.length == i && d.type == "contact";})
                .append("circle")
                .attr("class", function (d) { return "node " + d.type; })
                .attr("r", circle_radius-(c/i)*circle_radius)
                .style("fill", function (d) { return d.colors[c]; })
                .style("stroke-width", 0)
                //.style("opacity", 0.7)
                .each(function (d) {
                    d.delta = 15;
                })
                .call(d3cola.drag);
        }
    }

    //only for rect (NOT contact)
    for (var i = 1; i<=max_node_colors_nbr; i++){

        for (var c = 0; c< i; c++){
            node.filter(function(d) { return d.colors.length == i && d.type != "contact";})
                .append("rect")
                .attr("class", function (d) { return "node " + d.type; })
                .attr("data_delta", function (d) { return c; })
                .attr("data_delta_max", function (d) { return i; })
                .attr("rx", function (d) {return getRadiusFromStyle(d.type)-getRadiusFromStyle(d.type)*c/i})
                .attr("ry", function (d) {return getRadiusFromStyle(d.type)-getRadiusFromStyle(d.type)*c/i})
                .style("fill", function (d) { return d.colors[c]; })
                .style("stroke-width", 0)
                //.style("opacity", 0.7)
                .each(function (d) {
                    d.delta = 0;
                })
                .call(d3cola.drag);
        }
    }

    var label = vis.selectAll(".label")
        .data(graph.nodes)
        .enter().append("text")
        .attr("class", "label")
        .style("fill", function (d) {
            if (d.type == "contact") {
                return "black";
            } else {
                return pickTextColorBasedOnBgColorAdvanced(d.colors[d.colors.length - 1], "white", "black");
            }
        })
        .text(function (d) { return d.name; })
        .call(d3cola.drag)
        .each(function (d) {
            var b = this.getBBox();
            var extra = 2 * margin + 2 * pad;
            d.width = b.width + extra;
            d.height = b.height + extra;
        });

    node.append("title")
        .text(function (d) { return d.name; });

    node.filter(function(n){ return n.properties['slug'] != undefined ; }).on("click", function(n) {
        var url = getDwLink(n);
        var win = window.open(url, '_blank');
        win.focus();
    });
    label.filter(function(n){ return n.properties['slug'] != undefined ; }).on("click", function(n) {
        var url = getDwLink(n);
        var win = window.open(url, '_blank');
        win.focus();
    });

    d3cola.start(50, 100, 200).on("tick", function () {
        node.each(function (d) { d.innerBounds = d.bounds.inflate(-margin); })
            .selectAll(".node")
            .attr("x", function (d) { return d.innerBounds.x + d.innerBounds.width()/2*(d3.select(this).attr("data_delta")/d3.select(this).attr("data_delta_max")); })
            .attr("y", function (d) { return d.innerBounds.y + d.innerBounds.height()/2*(d3.select(this).attr("data_delta")/d3.select(this).attr("data_delta_max")); })
            .attr("width", function (d) { return d.innerBounds.width() - d.innerBounds.width()*(d3.select(this).attr("data_delta")/d3.select(this).attr("data_delta_max")); })
            .attr("height", function (d) { return d.innerBounds.height() - d.innerBounds.height()*(d3.select(this).attr("data_delta")/d3.select(this).attr("data_delta_max")); })
            .attr("cx", function (d) { return d.innerBounds.x + (d.innerBounds.width()/2); })
            .attr("cy", function (d) { return d.innerBounds.y + (d.innerBounds.height()/2); });

        link.selectAll(".link")
            .attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });

        label
            .attr("x", function (d) { return d.x })
            .attr("y", function (d) { return d.y + (d.height/2 - margin  - pad )/2 - d.delta});
    });
});
