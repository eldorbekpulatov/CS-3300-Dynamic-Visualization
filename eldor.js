d3.csv("data/top250-00-19.csv", function(error2, data2) {
    d3.csv("data/countries_mapping.csv", function(error3, data3) {
        d3.csv("data/country_centroids.csv", function(error4, data4) {
            // Data Files
            let transferData = data2;
            let leaguesToCountry = data3;
            let countryCoords = data4;

            // Global Variables
            let leaguesData = {};
            let leagues = {};
            let coords = {};

            // Create object containing all leagues and map to their respective country
            leaguesToCountry.forEach((d,i) => {
                leagues[d["league"]] = d["country"];
            });

            // Country name to coordinate mapping
            countryCoords.forEach((d,i)=>{
                coords[d["name"]] = [d["longitude"],d["latitude"]];
            });

            // maps leagues -> (country, coords)
            for (let key in leagues){
                let v = leagues[key];
                leaguesData[key] = {};
                leaguesData[key].country = v;
                leaguesData[key].coords = coords[v];
            };

            // format country names
            function formatCountryNames(countryNames){
                let dict = {};
                for(let i = 0; i< countryNames.length; i++){
                    dict[countryNames[i].id] = countryNames[i].name;
                }
                return dict;
            }

            function uniqueTransfers(data) {
                let formatted = {};
                for (let i=0; i< data.length; i++){
                    let transfer=data[i];
                    let path=[leaguesData[transfer["League_from"].trim()].country,leaguesData[transfer["League_to"].trim()].country];
                    
                    if (!(transfer["Season"] in formatted)){
                        formatted[transfer["Season"]] = {};
                    };
                    
                    let yearKey = transfer["Season"];
                    if (!(path[0] in formatted[yearKey])){
                        formatted[yearKey][path[0]] = {};
                    };
                    
                    if (!(path[1] in formatted[yearKey][path[0]])){
                        formatted[yearKey][path[0]][path[1]] = {};
                        formatted[yearKey][path[0]][path[1]].number = 0;
                        formatted[yearKey][path[0]][path[1]].sum_amount = 0;
                        formatted[yearKey][path[0]][path[1]].transfers = [];
                    };
                    formatted[yearKey][path[0]][path[1]].number += 1;
                    formatted[yearKey][path[0]][path[1]].sum_amount += Number(transfer["Transfer_fee"]);
                    formatted[yearKey][path[0]][path[1]].transfers.push(transfer);
                };
                return formatted;     
            };
            
            // needed to get the lines,circles seperated and in drawable format
            function usableFormat(transferDict){
                var usableDict = {"lines":{}, "circles":{}};
                for (let key in transferDict) {
                    let yr = key.split("-")[0];
                    usableDict['lines'][yr]= [];
                    usableDict['circles'][yr]= [];

                    for(let k1 in transferDict[key]){
                        for(let k2 in transferDict[key][k1]){
                            if (k1 == k2){
                                let c = {   "type": "Feature", 
                                            "properties": { "name": k1 }, 
                                            "geometry": {   "type": "Point", 
                                                            "coordinates": coords[k1] },
                                            "transfers":  transferDict[key][k1][k2].number
                                        };
                                usableDict['circles'][yr].push(c);
                            }else{
                                let l = {   
                                    "countries": [k1,k2],
                                    "transfers": transferDict[key][k1][k2].number,
                                    "avg_cost": transferDict[key][k1][k2].sum_amount/transferDict[key][k1][k2].number,
                                };
                                usableDict['lines'][yr].push(l);   
                            }
                        }
                    }
                }
                return usableDict;
            };

            function color(number){
                if (number > 8){
                    return "red";
                }
                return lineColor(number);
            }

            ////////////////////////////////////////////////////////////
            var usable = usableFormat(uniqueTransfers(transferData));
            var lines = usable.lines;
            var circles = usable.circles;
            var slider = document.getElementById("myRange");
            var europeButton = d3.select("#europe");
            var asiaButton = d3.select("#asia");
            var africaButton = d3.select("#africa");
            var australiaButton = d3.select("#australia");
            var namericaButton = d3.select("#northamerica");
            var samericaButton = d3.select("#southamerica");
            var worldButton = d3.select("#world");
            var lastClickedButton = "world"; // needed to animate world view
            slider.value = "2005";
            // SVG
            var svg = d3.select("svg#globe");
            var width = svg.attr("width"),
                height = svg.attr("height");
            
            // projection vars and scales
            var proj = d3.geoOrthographic()
                    .scale(350) // sets the size of the globe in svg
                    .translate([width / 2 + 600, height / 2])
                    .rotate([-50, -20]) // sets the initail rotation of globe
                    .clipAngle(90); // change this to 180 for transparent globe
            var path = d3.geoPath().projection(proj).pointRadius(1.5);
            var graticule = d3.geoGraticule();
            var pathWidth = d3.scaleLinear().domain([0, 50]).range([0,100]);
            var lineColor = d3.scaleLinear().domain([0,8]).range(["black", "red"]);
            
            // animation variables
            var timer = d3.timer(function() {}),
                v0, // Mouse position in Cartesian coordinates at start of drag gesture.
                r0, // Projection rotation as Euler angles at start.
                q0; // Projection rotation as versor at start.   

            // event listeners
            svg.call(d3.drag()
                .on("start", eventstarted)
                .on("drag", dragged));
            svg.call(d3.zoom()
                .on("start", eventstarted)
                .on('zoom', zoomed));
            slider.oninput=function(){
                    // updates year display
                    jQuery(document).ready(function ($) {
                        $("#box-buttons").css({"opacity": "", "pointer-events": "none"});
                    });
                    let year=document.getElementById("year");
                    year.innerHTML="Year: "+this.value;

                    jQuery(document).ready(function ($) {   
                        $(".clicked").removeClass("clicked");
                        $(".hidden").removeClass("hidden");
                    });

                    // updates and transitions the lines
                    let ls = svg.selectAll("path.redline").data(lines[this.value]);
                    ls.exit().transition().duration(500).attr("stroke-width",0).remove();

                    ls.transition().duration(500)
                        // .attr("stroke-width", d => pathWidth(d.transfers))
                        .attr("countryFrom", d => d.countries[0])
                        .attr("countryTo", d => d.countries[1]);

                    ls.enter().append("path")
                        .attr("class", "redline")
                        .attr("d", d => lineFromTo(d.countries[0],d.countries[1]))
                        .attr('stroke-width', 0)
                        .transition().duration(500)
                        .attr("stroke-width",d=>pathWidth(d.transfers))
                        .attr("stroke", d => color(d.transfers))
                        .attr("countryFrom", d => d.countries[0])
                        .attr("countryTo", d => d.countries[1])
                        .attr("number", d => d.transfers);
                    
                    // // updates and transitions the circles
                    let cs = svg.selectAll("path.point").data(circles[this.value]);
                    cs.exit().transition().duration(500).attr("stroke-width",0).remove();
                    cs.transition().duration(500).attr("stroke-width", d => pathWidth(d.transfers));
                    cs.enter().append("path")
                        .attr("class", "point")
                        .attr("d", path)
                        .attr('stroke-width', d => proj.scale() * pathWidth(d.transfers) / 600);

                    // d3.select("#small_circle").append("path")
                    //     .attr("id", "ex1")
                    //     .attr("class", "point")
                    //     .attr("d", path)
                    //     .attr('stroke-width', proj.scale() * pathWidth(1) / 600);
    
                    // d3.select("#large_circle").append("path")
                    //     .attr("id", "ex10")
                    //     .attr("class", "point")
                    //     .attr("d", path)
                    //     .attr('stroke-width', proj.scale() * pathWidth(10) / 600);
    
                    // redraws
                    refresh();
            };
            europeButton.on("click", function(){
                animateTo([-14, -45],1000, 1000);
                lastClickedButton = "europe";
            })
            asiaButton.on("click", function(){
                animateTo([-80, -42],600, 1000);
                lastClickedButton = "asia";
            })
            africaButton.on("click", function(){
                animateTo([-18, 0],500, 1000);
                lastClickedButton = "africa";
            })
            australiaButton.on("click", function(){
                animateTo([-135, 30],600, 1000);
                lastClickedButton = "australia";
            })
            samericaButton.on("click", function(){
                animateTo([65, 21],520, 1000);
                lastClickedButton = "samerica";
            })
            namericaButton.on("click", function(){
                animateTo([105, -42],600, 1000);
                lastClickedButton = "namerica";
            })
            worldButton.on("click", function(){
                if (lastClickedButton == "world"){ 
                    ready();
                    spin();
                }else{
                    animateTo([r0[0], -20],300, 1000);
                    setTimeout(spin,1000); // waits for animation to finish
                }
                lastClickedButton = "world";
            })
            function determineName(countryNames, id){
                return countryNames[id];
            }

            // asyncronous call to load the map
            queue()
                // .defer(d3.json, "data/world_110m.json")
                .defer(d3.json, "data/110m.json")
                .defer(d3.tsv,"data/world-country-names.tsv")
                // .defer(d3.json, "data/world-countries.json")
                .await(ready);

            // draws the initial globe
            function ready(error, world, countrynames) {
                countrynames = formatCountryNames(countrynames);
                
                svg.append("path")
                    .datum(topojson.object(world, world.objects.land))
                    .attr("class", "land")
                    .attr("d", path);

                svg.append("path")
                    .datum(graticule)
                    .attr("class", "graticule noclicks")
                    .attr("d", path);
                
                svg.append("g").attr("class","countries")
                    .selectAll("path")
                    .data(topojson.object(world, world.objects.countries).geometries)
                    .enter().append("path")
                    .attr("class", "country")
                    .attr("id", d => parseInt(d.id))
                    .attr("country", d => determineName(countrynames, Number(d.id)))
                    .attr("d", path); 
                
                svg.append("g").attr("class","points")
                    .selectAll(".text").data(circles[slider.value])
                    .enter().append("path")
                    .attr("class", "point")
                    .attr("d", path)
                    .attr('stroke-width', d=>pathWidth(d.transfers)*(proj.scale()/600));


                svg.append("g").attr("class","alllines")
                    .selectAll(".redline").data(lines[slider.value])
                    .enter().append("path")
                    .attr("class", "redline")
                    .attr("d", d => lineFromTo(d.countries[0],d.countries[1]))
                    .attr("stroke", d => color(d.transfers))
                    .attr('stroke-width', d=>pathWidth(d.transfers))
                    .attr("countryFrom", d => d.countries[0])
                    .attr("countryTo", d => d.countries[1])
                    .attr("number", d => d.transfers)

                let info_box = d3.select("#information-box");

                // d3.select("#small_circle").append("path")
                //     .attr("id", "ex1")
                //     .attr("class", "point")
                //     .attr("d", path)
                //     .attr('stroke-width', proj.scale() * pathWidth(1) / 600);

                // d3.select("#large_circle").append("path")
                //     .attr("id", "ex10")
                //     .attr("class", "point")
                //     .attr("d", path)
                //     .attr('stroke-width', proj.scale() * pathWidth(10) / 600);

                    // .attr("money", d => d.avg_cost);

                // draw and start spinning
                refresh();
                spin();

                jQuery(document).ready(function ($) {
                    $("path.redline").click(function(){
                        if(this.classList.contains("clicked")){
                            $(".redline.clicked").removeClass("clicked");
                            $("#country-from").html("From: ");
                            $("#country-to").html("To: ");
                            $("#number").html("Number of Transfers: ");
                        }else {
                            $(".redline.clicked").removeClass("clicked");
                            $("#country-from").html("From: "+$(this).attr("countryFrom"));
                            $("#country-to").html("To: "+$(this).attr("countryTo"));
                            $("#number").html("Number of Transfers: "+$(this).attr("number"));
                            this.classList.add("clicked");
                        } 
                    });
                    // updates the the country name on hover
                    $("path.country").hover(
                        function() {
                            d3.select("h2#country").text(this.getAttribute('country'));
                        }, 
                        function() {
                            if (d3.selectAll(".clicked").size() ==0 ){
                                d3.select("h2#country").text("All Countries");
                            }else{
                                d3.select("h2#country").text(d3.select(".clicked").attr("country"))
                            }
                            
                        }
                    );

                    $("path.country").click(function(){
                        $(".redline.clicked").removeClass("clicked");
                        $("#country-from").html("From: ");
                        $("#country-to").html("To: ");
                        $("#number").html("Number: ");
                        $("#box-buttons button").removeClass("clicked");
                        if(this.classList.contains("clicked")){
                            $(".country.clicked").removeClass("clicked");
                            $(".hidden").removeClass("hidden");
                            $("#box-buttons").css({"opacity": "", "pointer-events": ""});
                            $("#country").html("All Countries");
                        }else {
                            $(".country.clicked").removeClass("clicked");
                            this.classList.add("clicked");
                            $(".hidden").removeClass("hidden");
                            $("#box-buttons").css({"opacity": "1", "pointer-events": "all"});
                            let c=this.getAttribute("country");
                            $("#country").html(c);
                            // alert(c);
                            $("path.redline").each(function(){
                                if($(this).attr("countryFrom")!=c && $(this).attr("countryTo")!=c) {
                                    this.classList.add("hidden");
                                }
                            });
                            $("#in").click(function(){
                                $("path.redline").removeClass("hidden");
                                $("path.redline").each(function(){
                                    if($(this).attr("countryTo")!=c) {
                                        this.classList.add("hidden");
                                    }
                                });
                            })
                            $("#out").click(function(){
                                $("path.redline").removeClass("hidden");
                                $("path.redline").each(function(){
                                    if($(this).attr("countryFrom")!=c) {
                                        this.classList.add("hidden");
                                    }
                                });
                            })
                            $("#all").click(function(){
                                $("path.redline").removeClass("hidden");
                                $("path.redline").each(function(){
                                    if($(this).attr("countryFrom")!=c && $(this).attr("countryTo")!=c) {
                                        this.classList.add("hidden");
                                    }
                                });
                            })
                        }
                        
                    });

                    $("button").click(function(){
                        if(this.classList.contains("button")){
                            $(".button").removeClass("clicked");
                        }else{
                            $("#information-box button").removeClass("clicked");
                        }
                        this.classList.add("clicked");
                    })
                });

            };

            // updates all the elements in svg
            function refresh() {
                svg.selectAll(".land").attr("d", path);
                svg.selectAll(".countries path").attr("d", path);
                svg.selectAll(".graticule").attr("d", path);
                svg.selectAll(".point").attr("d", path);
                svg.selectAll(".redline").attr("d", d => lineFromTo(d.countries[0],d.countries[1]));
            }

            // spins the globe 
            function spin() {
                timer.stop();
                timer = d3.timer(function() {
                    r0 = proj.rotate();
                    proj.rotate([r0[0] + 0.5, r0[1]]);
                    refresh();
                });
            };

            // animates from current (rotation,scale) to desired (rotation,scale)
            function animateTo(rotation, scale, duration){
                timer.stop();
                timer = d3.timer(function(elapsed) {
                    if (elapsed > duration){ timer.stop()};
                    r0 = proj.rotate();
                    s0 = proj.scale();
                    let steps = duration/12;
                        latDiff = rotation[0] - r0[0],
                        longDiff = rotation[1] - r0[1],
                        scaleDiff = scale - s0;
                        latStep = latDiff/steps,
                        longStep = longDiff/steps,
                        scaleStep = scaleDiff/steps;
                    proj.rotate([r0[0] + (latStep * 12) , r0[1] + (longStep * 12)]);
                    proj.scale(s0 + (scaleStep * 12));
                    // also scale all lines and circles
                    svg.selectAll("path.redline").attr("stroke-width", d=> pathWidth(d.transfers)*(proj.scale()/600));
                    svg.selectAll("path.point").attr("stroke-width", d=> pathWidth(d.transfers)*(proj.scale()/600));
                    refresh();
                }); 
            };
            
            // updated globals when external input gets triggered
            function eventstarted() {
                timer.stop();
                v0 = versor.cartesian(proj.invert(d3.mouse(this)));
                r0 = proj.rotate();
                q0 = versor(r0);
            }

            // handles zooming
            function zoomed() {
                // scale the globe
                let s = d3.event.transform.k * (height - 10) / 2;
                if(s<200){ s = 200; }else if(s>1000){ s=1000; }; // limits the zoom vals
                proj.scale(s);
                // also scale all lines and circles
                svg.selectAll("path.redline").attr("stroke-width", d=> pathWidth(d.transfers)*(s/600));
                svg.selectAll("path.point").attr("stroke-width", d=> pathWidth(d.transfers)*(s/600));
                
                let v1 = versor.cartesian(proj.rotate(r0).invert(d3.mouse(this))),
                    q1 = versor.multiply(q0, versor.delta(v0, v1)),
                    r1 = versor.rotation(q1);
                proj.rotate(r1);
                lastClickedButton = "zoom";
                refresh();
            };

            // handles dragging
            function dragged() {
                let v1 = versor.cartesian(proj.rotate(r0).invert(d3.mouse(this))),
                    q1 = versor.multiply(q0, versor.delta(v0, v1)),
                    r1 = versor.rotation(q1);
                proj.rotate(r1);
                lastClickedButton = "drag";
                refresh();
            };

            // looks up a path from c1 to c2
            var lineFromTo = function(c1,c2) {
                return path({"type": "LineString", "coordinates": [coords[c1], coords[c2]]});
            };

            ////////////////////////////////////////////////////////////
        });
    });
});
