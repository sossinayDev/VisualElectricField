const version_code = "v0.5"

// Simulation objects
charges = [];
sensors = {};
rigidbodies = {};

// Simulation constants
const k = 1 / (4 * Math.PI * (8.854187812813 * 10 ** (-12)));
const ELEMENTARY_CHARGE = 1.602176634e-19; // Coulombs

const MIN_DISTANCE = 1e-4; // 0.1 mm
const METERS_PER_PIXEL = 0.01;   // 1 pixel = 1 cm
// const k = 8.854187812813 * 10 ** (-12);

// UI shortcuts
let canvas = null;
let playpause_sim = null;
let playpause_rec = null;
let toggle_grid = null;
let toggle_lines = null;

let hover_threshold = 20;
let hover_details = [];

// UI settings
let grid_active = true;
let field_lines_active = true;
const accent = "#3451a3";

// Editor
let is_placing = false;
let item_placing = null;

// Undo history
let undo_history = [{ action: "initialize", state: null }];
let current_step = 0;

// Objects
let arrow_length = 100;
let arrow_width = 4;
let arrow_tip_length = 90;
let file_upload_input = null;

let selected_object = null;

// Tools
let is_picking = false;
let is_measuring = false;
let measurement = null;

// Grid
let grid_spacing = 100;
let point_radius = 2;
let rel_grid_spacing = 100;

// Lines
let line_width = 2;
let line_step = 15;
let precise_step = 5;
let rough_step = 60;
let straight_step = 600;
let check_step = 100;

// Input
let mouse_position_local = { x: 0, y: 0 };
let mouse_position_global = { x: 0, y: 0 };
let pressed_keys = [];

// Cursor
let cursor_override = null;

// Render cache
let render = [];

// Camera
let cam = {
    x: 0,
    y: 0,
    zoom: 1,
    last_x: 0,
    last_y: 0
};
const minZoom = 0.02;
const maxZoom = 4;
var ctx = null;
let offsetX = 0;
let offsetY = 0;

// flag to indicate a drag is in process
// and the last XY position that has already been processed
var isDown = false;
var lastX;
var lastY;

// the radian value of a full circle is used often, cache it
var PI2 = Math.PI * 2;

// Preload assets
let image_charge = null;
let image_sensor = null;

// jShare
const jshare_server = "https://pixelnet.xn--ocaa-iqa.ch/jshare";

// Hints
const hints = [
    "Use CTRL+Z and CTRL+Y to undo/redo",
    "Generate a share code to quickly distribute your simulation",
    "You can click the simulation code for advanced options",
    "Download a .JSON file for later",
    "The simulation is actually to scale!",
    "This whole thing is about 1'500 lines of code (as of March 28, 2026)",
    "You can measure distances and angles using the tape measure tool",
    "You can measure the field strenght at your cursor using the pinpoint tool!",
    "Don't use this for cheating!",
    "Educational purposes included (not only)",
    "You can select an object by clicking on it.",
    "Hover over a charge to quickly see it's strength",
    "When using Coulomb, space the charges further apart.",
    "You can export screenshots using the image button on the left",
    "Toggle the grid for more beautiful images!",
]

// General helper functions
function $(query) {
    return document.querySelector(query);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

function await_button_press(b) {
    return new Promise((resolve) => {
        // Attach one-time click handler
        b.onclick = () => {
            resolve();
        }
    });
}


// Math helper functions
function rad_to_deg(radians) {
    return radians * (180 / Math.PI);
}

function deg_to_rad(deg) {
    return deg / 180 * Math.PI;
}

function get_angle(x, y) {
    return Math.atan2(y, x);
}

function distance_between(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// Physics engine functions
function add_charge(x, y, q) {
    id = `charge-${(new Date).getTime()}`;
    charges.push({
        type: "charge",
        id: id,
        x: x,
        y: y,
        q: q
    });
    return id;
}

function remove_charge(charge_id) {
    let i = 0;
    let result = false;
    charges.forEach(charge => {
        if (charge.id === charge_id) {
            charges.splice(i, 1);
            result = true;
        }
        i++;
    });
    return result;
}

function get_charge_data(charge_id) {
    let result = null;
    charges.forEach(charge => {
        if (charge.id === charge_id) {
            result = charge;
        }
    });
    return result;
}

function set_charge_data(charge_id, data) {
    let result = false;
    let i = 0;
    charges.forEach(charge => {
        if (charge.id === charge_id) {
            charges[i] = data
            result = true;
        }
        i++;
    });
    return result;
}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function get_charge_at_point(scan_x, scan_y, debug = false) {
    let total = {
        x: 0,
        y: 0,
    };
    charges.forEach(charge => {
        let x = charge.x;
        let y = charge.y;
        let q = charge.q;

        if (debug) {
            // console.log(`Point: ${charge.id}\n${x}, ${y}\nCharge: ${q}`);
        }

        let diff_x = charge.x - scan_x;
        let diff_y = charge.y - scan_y;

        let dx = (charge.x - scan_x) * METERS_PER_PIXEL;
        let dy = (charge.y - scan_y) * METERS_PER_PIXEL;

        let distance = Math.sqrt(dx ** 2 + dy ** 2);
        distance = Math.max(distance, MIN_DISTANCE);

        let angle = get_angle(diff_x, diff_y);
        if (debug) {
            // console.log(`Calculated angle: ${rad_to_deg(angle)} deg`);
        }
        let strength = k * (q / distance ** 2);

        // clamp
        const MAX_FIELD = 1e6;
        strength = Math.min(Math.max(strength, -MAX_FIELD), MAX_FIELD);

        let comp_x = Math.cos(angle) * strength;
        let comp_y = Math.sin(angle) * strength;

        total.x += comp_x;
        total.y += comp_y;
    });

    total.angle = get_angle(total.x, total.y);
    total.value = Math.sqrt(total.x ** 2 + total.y ** 2);


    return total;
}

function get_nearest_charge(x, y, charge_type) {
    if (charges.length == 0) {
        return null
    }
    let min_distance = Infinity;
    let min_charge = { x: 0, y: 0, q: 0 };
    charges.forEach(c => {
        let valid = true
        if (charge_type == "positive" && c.q < 0) {
            valid = false
        }
        if (charge_type == "negative" && c.q > 0) {
            valid = false
        }
        if (valid) {
            let d = Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2);
            if (d < min_distance) {
                min_distance = d;
                min_charge = c;
            }
        }
    });
    min_charge.distance = min_distance;
    return min_charge
}

function get_nearest_object(x, y, type_filter = null, localize = false) {
    let objects = charges.concat(Object.values(sensors));

    if (objects.length == 0) {
        return { distance: Infinity };
    }

    let min = Infinity;
    let nearest = {};
    objects.forEach(element => {
        if (element.type == type_filter || type_filter == null) {
            let d = Infinity;
            if (localize) {
                d = distance_between(to_local({ x: x, y: y }), to_local(element));
            }
            else {
                d = distance_between({ x: x, y: y }, element);
            }
            if (d < min) {
                nearest = element;
                min = d;
            }
        }
    });
    nearest.distance = min;
    return nearest;
}

// Undo/Redo
function undo() {
    current_step -= 1;
    if (current_step < 0) {
        current_step = 0;
        return;
    }
    s(`Undo: ${undo_history[current_step].action}`)
    load_simulation(undo_history[current_step].state, true);
};

function redo() {
    current_step += 1;
    if (current_step > undo_history.length - 1) {
        current_step = undo_history.length - 1;
        return;
    }
    load_simulation(undo_history[current_step].state, true);
    s(`Redo: ${undo_history[current_step].action}`)
}

function add_state(action_type = "unknown") {
    s(`Action: ${action_type}`);

    current_step += 1;

    if (current_step != undo_history.length) {
        let na = []
        let i = 0;
        undo_history.forEach(a => {
            if (i < current_step) {
                na.push(JSON.parse(JSON.stringify(a)));
            }
            i++;
        });
        undo_history = na;
    }


    undo_history.push({
        action: action_type,
        state: JSON.parse(JSON.stringify(export_simulation(true)))
    })

    localStorage.setItem("visualelectric_autosave", JSON.stringify(export_simulation()));

}

// Rendering functions
function draw_point(x, y, size, color = "white") {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, deg_to_rad(360));
    ctx.fillStyle = color;
    ctx.fill();
}

function smoothen_camera() {
    cam.x = parseInt(cam.x);
    cam.y = parseInt(cam.y);
}

function to_local(vec2) {
    return {
        x: (vec2.x * cam.zoom + cam.x),
        y: (vec2.y * cam.zoom + cam.y)
    }
}

function draw_line(start_vec2, end_vec2, color = "white") {
    // console.log(`Drawing line from ${start_vec2.x}, ${start_vec2.y} to ${end_vec2.x}, ${end_vec2.y}`)
    ctx.beginPath();
    ctx.lineWidth = line_width;
    ctx.strokeStyle = color;
    ctx.moveTo(parseFloat(start_vec2.x), parseFloat(start_vec2.y));
    ctx.lineTo(parseFloat(end_vec2.x), parseFloat(end_vec2.y));
    ctx.stroke();
}

function draw_arrow(start_vec2, speed_vec2, color = "white") {
    let angle = get_angle(speed_vec2.x, speed_vec2.y) + Math.PI;
    let value = Math.sqrt(speed_vec2.x ** 2 + speed_vec2.y ** 2);

    // let tip = {
    //     x: start_vec2.x + speed_vec2.x,
    //     y: start_vec2.y + speed_vec2.y
    // };

    let tip = {
        x: start_vec2.x + Math.cos(angle) * arrow_length,
        y: start_vec2.y + Math.sin(angle) * arrow_length
    }

    let lt = {
        x: start_vec2.x + Math.cos(angle - 0.1) * arrow_tip_length,
        y: start_vec2.y + Math.sin(angle - 0.1) * arrow_tip_length,
    }

    let rt = {
        x: start_vec2.x + Math.cos(angle + 0.1) * arrow_tip_length,
        y: start_vec2.y + Math.sin(angle + 0.1) * arrow_tip_length,
    }

    // console.log(`Drawing line from ${start_vec2.x}, ${start_vec2.y} to ${tip.x}, ${tip.y}`)
    draw_line(start_vec2, tip, color);
    draw_line(tip, lt, color);
    draw_line(tip, rt, color);



    // ctx.beginPath();
    // ctx.lineWidth = arrow_width;
    // ctx.strokeStyle = color;
    // ctx.moveTo(start_vec2.x, start_vec2.y);
    // ctx.lineTo(tip.x, tip.y);
    // ctx.stroke();
}

let frametime_ms = 0;
function render_image() {
    let starttime = new Date().getTime();
    hover_details = [];

    if (cam.z == 0) {
        console.error("Camera zoom is 0, unable to calculate.")
        return
    }

    smoothen_camera();

    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)



    if (grid_active) {
        let rel_gs = grid_spacing * cam.zoom;

        // Define base threshold and scaling factor
        let baseZoom = 0.4;
        let scaleFactor = 2;

        // If zoom is below base, scale up spacing procedurally
        if (cam.zoom < baseZoom) {
            let steps = Math.floor(Math.log(baseZoom / cam.zoom) / Math.log(scaleFactor));
            rel_gs *= Math.pow(scaleFactor, steps);
        }

        // // Draw grid points
        // let rel_gs = grid_spacing * cam.zoom;
        // if (cam.zoom < 0.11) {
        //     rel_gs *= 16;
        // }
        // // else {
        // //     let a = 0.2;
        // //     let f = 8;
        // //     let done = false;
        // //     while (!done){
        // //         if (cam.zoom < a) {
        // //             rel_gs *= f;
        // //             done = true;
        // //         }
        // //         a += 0.1;
        // //         f /= 2;
        // //     }
        // // }
        // else if (cam.zoom < 0.2) {
        //     rel_gs *= 8;
        // }
        // else if (cam.zoom < 0.3) {
        //     rel_gs *= 4;
        // }
        // else if (cam.zoom < 0.4) {
        //     rel_gs *= 2;
        // }

        rel_grid_spacing = rel_gs / cam.zoom;

        let x = -2 * rel_gs;
        let y = -2 * rel_gs;

        let x_off = cam.x;
        let y_off = cam.y;
        while (x_off < 0) {
            x_off += rel_gs;
        }
        while (y_off < 0) {
            y_off += rel_gs;
        }
        while (x_off > rel_gs) {
            x_off -= rel_gs;
        }
        while (y_off > rel_gs) {
            y_off -= rel_gs;
        }

        x += x_off;
        y += y_off;

        // console.log(`Start positions calculated:\nx: ${x}\ny: ${y}`);

        let base_y = y
        while (x < canvas.width) {
            x += rel_gs;
            y = base_y;
            while (y < canvas.height) {
                y += rel_gs;
                if (parseInt(x - cam.x) == 0 || parseInt(y - cam.y) == 0) {
                    draw_point(x, y, point_radius * 2);
                }
                else {
                    draw_point(x, y, point_radius);
                }
            }
        }
    }

    render.forEach(render_element => {
        let selected = false;
        if (selected_object != null) {
            selected = render_element.id == (selected_object.id || "not-an-id");
        }
        if (render_element.type == "line") {
            draw_line(to_local(render_element.p1), to_local(render_element.p2), render_element.color);
        }
        if (render_element.type == "arrow") {


            let fs = {
                x: render_element.vec.x * cam.zoom * 100,
                y: render_element.vec.y * cam.zoom * 100
            };
            // draw_point(to_local(render_element.p).x,to_local(render_element.p).y,10,"red")
            if (selected) {
                draw_arrow(to_local(render_element.p), fs, accent);
            }
            else {
                draw_arrow(to_local(render_element.p), fs);
            }
        }
        if (render_element.type == "image") {
            const x = to_local(render_element.p).x - 20;
            const y = to_local(render_element.p).y - 20;
            const w = render_element.image.width;
            const h = render_element.image.height;

            ctx.drawImage(render_element.image, x, y);

            if (selected) {
                // Apply blue tint (accent)
                ctx.save();
                ctx.globalCompositeOperation = "source-atop";
                ctx.fillStyle = accent; // your blue color
                ctx.fillRect(x, y, w, h);
                ctx.restore();
            }

            if (
                distance_between(to_local(mouse_position_local), to_local(render_element.p)) < hover_threshold &&
                Object.keys(render_element).includes("hover")
            ) {
                hover_details.push(render_element.hover);
            }
        }
        if (render_element.type == "label") {
            const x = to_local(render_element.p).x;
            const y = to_local(render_element.p).y - 20;

            const text = render_element.text;

            draw_text(text, x, y, "10pt", true, true);
        }
    });

    if (is_placing) {
        let m_x = mouse_position_local.x;
        let m_y = mouse_position_local.y;
        if (pressed_keys.includes("Shift")) {
            m_x = Math.round(m_x / rel_grid_spacing) * rel_grid_spacing;
            m_y = Math.round(m_y / rel_grid_spacing) * rel_grid_spacing;
        }
        let p = to_local({ x: m_x, y: m_y });
        ctx.drawImage(target, p.x - 20, p.y - 20)
    }

    if (measurement != null && Object.keys(measurement).includes("start")) {
        let sp = measurement.start;
        let ep = mouse_position_local;
        if (Object.keys(measurement).includes("end")) {
            ep = measurement.end;
        }

        draw_line(to_local(sp), to_local(ep), "green");

        let cx = (to_local(sp).x + to_local(ep).x) / 2
        let cy = (to_local(sp).y + to_local(ep).y) / 2

        let length = Math.sqrt((sp.x - ep.x) ** 2 + (sp.y - ep.y) ** 2) * METERS_PER_PIXEL;
        let angle = get_angle(sp.x - ep.x, sp.y - ep.y);

        const text = `${length.toExponential(2)}m / ${Math.round(rad_to_deg(angle) * 10) / 10}°`

        draw_text(text, cx, cy, "10pt", true, true)
    }

    if (is_picking) {
        let pos = to_local(mouse_position_local);

        const text = `${get_charge_at_point(mouse_position_local.x, mouse_position_local.y).value.toExponential(2)} V/m`;

        draw_text(text, pos.x - 10, pos.y - 10, "10pt", true, false);
    }

    frametime_ms = new Date().getTime() - starttime;
    rendered_frames += 1;

    draw_indicators();
}

async function calculate_frame(physics = false) {

    render = [];
    if (physics) {
        // s("Calculating new frame with physics");
    }
    else {
        // s("Calculating new frame without physics");
    }
    await delay(10);

    let spreads = [
        deg_to_rad(10),
        deg_to_rad(50),
        deg_to_rad(90),
        deg_to_rad(130),
        deg_to_rad(170),
        deg_to_rad(210),
        deg_to_rad(250),
        deg_to_rad(290),
        deg_to_rad(330)
    ]

    // Draw charge icons
    // s("Calculating charges");
    await delay(10);
    let charge_i = 0

    const START_RADIUS = 20;


    charges.forEach(charge => {
        charges[charge_i].type = "charge";

        // console.log(`Rendering charge at\nx: ${charge.x}\ny: ${charge.y}\n===\nThat is on screen:\nx_onscreen: ${(charge.x - 16) * cam.zoom - cam.x}\ny_onscreen: ${(charge.y - 16) * cam.zoom - cam.y}`);
        let pos = charge

        if (field_lines_active) {
            spreads.forEach(s => {
                let l_x = charge.x + Math.cos(s) * START_RADIUS;
                let l_y = charge.y + Math.sin(s) * START_RADIUS;

                render.push({
                    type: "line",
                    p1: charge,
                    p2: { x: l_x, y: l_y },
                    color: "white",
                    // color: `${getRandomColor()}`,
                })

                let l_t = "positive";
                let l_g = "negative";
                if (charge.q < 0) {
                    l_t = "negative";
                    l_g = "positive";
                }
                // console.log(l_g);
                let j = 0;

                let done = false;
                while (!done) {
                    let nc = get_nearest_charge(l_x, l_y, l_g);
                    if (nc.distance < START_RADIUS || j > 2000) {
                        done = true;
                    }
                    if (nc.distance == Infinity && j > 2000) {
                        done = true;
                    }

                    let f = get_charge_at_point(l_x, l_y);
                    let angle = f.angle;
                    if (l_t == "positive") {
                        angle = f.angle + deg_to_rad(180);
                    }

                    p1 = JSON.parse(JSON.stringify({
                        x: l_x,
                        y: l_y
                    }));

                    l_x += Math.cos(angle) * check_step;
                    l_y += Math.sin(angle) * check_step;


                    let f2 = get_charge_at_point(l_x, l_y, l_g);
                    let angle2 = f2.angle;
                    if (l_t == "positive") {
                        angle2 = f2.angle + deg_to_rad(180);
                    }

                    let angle_difference = rad_to_deg(Math.max(Math.abs(angle2 - angle), 0.05));


                    let v = Math.max(line_step, 3);
                    if (angle_difference > 10) {
                        v = precise_step;
                    }
                    if (angle_difference < 5) {
                        v = rough_step;
                    }
                    if (angle_difference < 1) {
                        v = straight_step;
                    }
                    if (v > nc.distance) {
                        v = nc.distance;
                    }


                    l_x = p1.x + Math.cos(angle) * v;
                    l_y = p1.y + Math.sin(angle) * v

                    let p2 = {
                        x: l_x,
                        y: l_y
                    };

                    if (nc.distance < START_RADIUS) {
                        p2 = nc;
                    }

                    // console.log(p2);
                    render.push({
                        type: "line",
                        p1: p1,
                        p2: p2,
                        color: "white",
                        // color: `${getRandomColor()}`,
                    })
                    j++;
                }
            });
        }

        let h = `Charge: ${charge.q} C`
        if (charge.q < 0.0001) {
            h = `Charge: ${charge.q / ELEMENTARY_CHARGE} e`
        }
        render.push({
            id: charge.id,
            type: "image",
            p: {
                x: pos.x,
                y: pos.y
            },
            image: image_charge,
            hover: h
        });

        charge_i++;
        // s(`Calculating charges... (${parseInt(charge_i / (charges.length - 1) * 100)}%)`);
    });

    // s("Calculating sensors...");
    await delay(10);
    // Draw sensors and arrows
    Object.keys(sensors).forEach(sensor_key => {
        let sensor = sensors[sensor_key];
        let fs = get_charge_at_point(sensor.x, sensor.y, true);

        // draw_point(spos.x,spos.y,10,"red");
        // draw_point(spos.x+fs.x,spos.y+fs.y,5,"blue");
        if (sensor.type == "arrow") {
            render.push({
                id: sensor.id,
                type: "arrow",
                p: sensor,
                vec: fs
            });
        }
        else if (sensor.type == "sensor") {
            render.push({
                id: sensor.id,
                type: "image",
                p: {
                    x: sensor.x,
                    y: sensor.y
                },
                image: image_sensor
            })
            render.push({
                id: sensor.id,
                type: "label",
                p: {
                    x: sensor.x,
                    y: sensor.y - 20
                },
                text: `${fs.value.toExponential(2)} V/m`
            })
        }
    });
    render_image();

    s("Calculated new frame")
}


// UI Interactions

function set_status(text) {
    $("#job_progress").innerHTML += "<br>" + text;
    let newIH = "";
    // console.log($("#job_progress").innerHTML.split("<br>"));
    // console.log($("#job_progress").innerHTML.split("<br>").slice(-10));
    $("#job_progress").innerHTML.split("<br>").slice(-10).forEach(line => {
        if (line != "") {
            newIH += `<br>${line}`;
        }
    });
    // console.log(newIH)
    $("#job_progress").innerHTML = newIH;
}
function s(text) {
    set_status(text);
}

function export_simulation(share = false) {
    let d = {
        charges: charges,
        sensors: sensors,
        rigidbodies: rigidbodies,
    }
    if (!share) {
        d.undo_history = undo_history;
        d.current_step = current_step;
    }
    return d;
}

function share() {
    let n = getRandomColor().replaceAll("#", "");
    let code = `vef-simulation-${n}`;

    jshare("set", code, value = JSON.stringify(export_simulation(true)));

    $("#share_code").innerHTML = `Simulation shared. <a href="javascript:fullscreen_code()">Code: ${n}</a>`
    $("#code").textContent = n

    fullscreen_code();
}

function close_popup() {
    $("#overlay").style.display = "none";
}

function fullscreen_code() {
    $("#overlay").style.display = "flex";
}

function show_popup(content, type = "none") {
    $("#popup_layer").style.display = "flex";
    $("#popup_content").innerHTML = content;
    $("#popup").classList.remove("warn");
    $("#popup").classList.remove("error");
    $("#popup").classList.add(type);
    $("#close_popup_button").style.display = "flex";
    $("#close_popup_button").onclick = close_small_popup;
    $("#close_popup_button").textContent = "Close";
}

function close_small_popup() {
    $("#popup_layer").style.display = "none";
}

async function popup_prompt(text, callback_function = console.log, type="none") {
    console.log(`Prompting: ${text}`)
    $("#popup_layer").style.display = "flex";
    $("#popup_content").innerHTML = `
<h1>Enter input</h1><br>
<p>${text}</p>
<input id="popup_input"></input>
    `
    $("#popup").classList.remove("warn");
    $("#popup").classList.remove("error");
    $("#popup").classList.add(type);
    $("#close_popup_button").style.display = "flex";
    $("#close_popup_button").onclick = null;
    $("#close_popup_button").textContent = "Submit";
    await delay(10);
    $("#popup_input").focus()
    $("#popup_input").addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            $("#close_popup_button").click();
        }
    });

    await await_button_press($("#close_popup_button"));
    close_small_popup();

    callback_function($("#popup_input").value);
    return $("#popup_input").value;
}

let value = false;
async function popup_confirm(text, ytext, ntext, callback_true, callback_false, type="none"){
    if (callback_false == null){
        callback_false = console.log
    }
    if (callback_true == null){
        callback_true = console.log
    }

    console.log(`Prompting: ${text}`)
    
    $("#popup_content").innerHTML = `
<h1>Please confirm</h1><br>
<p>${text}</p>
    `
    let ybtn = document.createElement("button");
    ybtn.textContent = ytext
    ybtn.onclick = ()=>{callback_true(); close_small_popup()}
    $("#popup_content").appendChild(ybtn);

    let nbtn = document.createElement("button");
    nbtn.textContent = ntext
    nbtn.onclick = ()=>{callback_false(); close_small_popup()}
    $("#popup_content").appendChild(nbtn);

    $("#popup").classList.remove("warn");
    $("#popup").classList.remove("error");
    $("#popup").classList.add(type);
    $("#close_popup_button").style.display = "none";

    $("#popup_layer").style.display = "flex";
}


async function enter_code(code = null) {
    if (code == null) {
        code = (await popup_prompt("Enter the share code")).trim()
    }
    s("Getting data...");
    await delay(100);
    let data = await jshare("get", `vef-simulation-${code}`);
    s("Got data");
    if (!data.success) {
        console.log(data.error);
        if (data.error == "Data expired") {
            show_popup("<h1>Oh shoot!</h1><br><p>This simulation code has expired. Ask the owner for a new one, or upload a .json file.</p>", "error");
        }
        else {
            show_popup("<h1>Hmmmm</h1><br><p>Failed to fetch simulation data. Is the code typed in correctly?</p>", "error");
        }
        s("Failed to fetch");
        return
    }

    await delay(100);
    data = JSON.parse(data.value);
    s("Data parsed");
    await delay(100);

    load_simulation(data);

    calculate_frame();
    render_image();
    undo_history = [{ action: "load", state: JSON.parse(JSON.stringify(export_simulation(true))) }];
    current_step = 0;
    s("Successfully loaded simulation");
    await delay(1000);
    calculate_frame();
    render_image();
}

function download_image() {
    let image = canvas.toDataURL("image/png");
    let link = document.createElement('a');

    let name = "simulation_screenshot";

    link.download = `${name}.png`;
    link.href = image;

    link.click();
}

function copy_code() {
    $("#copycode").textContent = "Code copied!";
    navigator.clipboard.writeText($("#code").textContent);
    setTimeout(() => {
        $("#copycode").textContent = "Copy code";
    }, 750);
}

function copy_link() {
    $("#copylink").textContent = "Link copied!";
    navigator.clipboard.writeText(`https://sossinaydev.ch/VisualElectricField#${$("#code").textContent}`);
    setTimeout(() => {
        $("#copylink").textContent = "Generate link";
    }, 750);
}

function download() {
    let file = JSON.stringify(export_simulation())
    let link = document.createElement("a");
    link.download = "simulation.json";
    link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(file);
    link.click();
}

function upload() {
    file_upload_input = document.createElement("input");
    file_upload_input.type = "file";
    file_upload_input.accept = ".json";
    file_upload_input.onchange = load_data;
    file_upload_input.click();
}

function load_data() {
    let reader = new FileReader();
    // console.log(file_upload_input.value);

    let display_file = (e) => { // set the contents of the <textarea>
        console.info('. . got: ', e.target.result.length, e);
        let data = JSON.parse(e.target.result);
        load_simulation(data);
    };

    let on_reader_load = (fl) => {
        console.info('. file reader load', fl);
        return display_file; // a function
    };

    // Closure to capture the file information.
    reader.onload = on_reader_load(file_upload_input.value);

    // Read the file as text.
    reader.readAsText(file_upload_input.files[0]);
}

function load_simulation(data, skip_undohistory) {
    data = JSON.parse(JSON.stringify(data));
    if (data == null) {
        data = {
            charges: [],
            sensors: {},
            rigidbodies: {},
        }
    }
    charges = data.charges;
    sensors = data.sensors;
    rigidbodies = data.rigidbodies;

    if (Object.keys(data).includes("undo_history") && Object.keys(data).includes("current_step") && !skip_undohistory) {
        undo_history = data.undo_history;
        current_step = data.current_step
    }

    calculate_frame();
    render_image();
}

async function jshare(type, code, value = "foobar") {
    data = {
        type: type,
        key: code,
        value: value
    }

    let response = await fetch(jshare_server, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
    });
    return await response.json();
}

function request_clear_canvas() {
    popup_confirm(`Do you really want to delete everything? This cant be undone.`,"Yes, delete", "Cancel",clear_canvas,null,"warn")
}

function clear_canvas() {
    charges = [];
    sensors = {};
    rigidbodies = {};
    undo_history = []
    add_state("initialize");
    current_step = 0;
    calculate_frame();
    render_image();
}

function toggle_setting(setting) {
    if (setting == "grid") {
        grid_active = !grid_active;
        if (grid_active) {
            toggle_grid.src = "static/visualelectricfield/img/grid_toggle.svg";
        }
        else {
            toggle_grid.src = "static/visualelectricfield/img/no_grid.svg";
        }
    }
    else if (setting == "lines") {
        field_lines_active = !field_lines_active;
        if (field_lines_active) {
            toggle_lines.src = "static/visualelectricfield/img/lines.svg";
        }
        else {
            toggle_lines.src = "static/visualelectricfield/img/no_lines.svg"
        }
    }
    calculate_frame();
}

function place_object(object) {
    is_picking = false;
    is_measuring = false;
    is_placing = true;
    set_cursor_override("grabbing");
    item_placing = object;
}

function toggle_measure() {
    is_picking = false;

    if (is_measuring) {
        set_cursor_override(null);
        is_measuring = false;
        measurement = null;
        render_image();
        return
    };

    set_cursor_override("crosshair")
    is_measuring = true;
    measurement = null;
}

function set_cursor_override(co) {
    let style = document.getElementById("cursor-override-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "cursor-override-style";
        document.head.appendChild(style);
    }

    style.innerHTML = `* { cursor: ${co} !important; }`;
}

async function delete_current() {
    if (selected_object.type == "charge") {
        charges.forEach(c => {
            if (c.id == selected_object.id) {
                charges.splice(charges.indexOf(c), 1);
            }
        });
    }
    else if (["sensor", "arrow"].includes(selected_object.type)) {
        Object.keys(sensors).forEach(key => {
            let d = sensors[key];
            if (d.id == selected_object.id) {
                delete sensors[key];
            }
        });
    }


    selected_object = null;
    await calculate_frame();
    render_image();
    $("#inspector").innerHTML = `
    <i>No object selected</i>
    `
    add_state(`Deleted ${selected_object.id}`)
}

// Canvas movement
function handleMouseDown(e) {
    // tell the browser we'll handle this event
    e.preventDefault();
    e.stopPropagation();

    // save the mouse position
    // in case this becomes a drag operation
    lastX = parseInt(e.clientX - offsetX);
    lastY = parseInt(e.clientY - offsetY);

    if (!is_measuring) {
        if (!is_picking && !is_placing) {
            let nearest = get_nearest_object(mouse_position_local.x, mouse_position_local.y, null, true);
            console.log(nearest)
            // selected_object = null;
            if (nearest.distance < hover_threshold) {
                console.log(nearest);
                selected_object = nearest;
            }

            if (selected_object != null) {
                $("#inspector").innerHTML = `
                <i>Selected: ${selected_object.id}</i><br><br><strong>Parameters</strong>
                `
                Object.entries(selected_object).forEach(pair => {
                    let k = pair[0];
                    let v = pair[1];

                    if (!["hover", "distance"].includes(k)) {
                        if (k == "q") {
                            let f_q = `${v} C`;
                            if (v < 0.0001) {
                                f_q = `${v / ELEMENTARY_CHARGE} e`;
                            }
                            $("#inspector").innerHTML += `<span><strong>${k}: </strong><i>${f_q}</i></span><br>`
                        }
                        else {
                            $("#inspector").innerHTML += `<span><strong>${k}: </strong><i>${v}</i></span><br>`
                        }
                    }
                });
                let delete_btn = document.createElement("button");
                delete_btn.textContent = "Delete";
                delete_btn.onclick = delete_current;
                delete_btn.className = "delete_btn"
                $("#inspector").appendChild(delete_btn);
            }
            else {
                $("#inspector").innerHTML = `
                <i>No object selected</i>
                `
            }

        }

        isDown = true;
        return
    }
    if (measurement == null) {
        measurement = { start: mouse_position_local };
        return
    }
    if (!Object.keys(measurement).includes("end")) {
        measurement.end = mouse_position_local;
        set_cursor_override(null);
        is_measuring = false;
        render_image();
        return
    }
}

async function handleMouseUp(e) {
    // tell the browser we'll handle this event
    e.preventDefault();
    e.stopPropagation();

    if (e.button === 2) {



        is_placing = false;
        return;
    }

    // stop the drag
    isDown = false;

    if (is_placing) {
        let m_x = mouse_position_local.x;
        let m_y = mouse_position_local.y;
        if (pressed_keys.includes("Shift")) {
            m_x = Math.round(m_x / rel_grid_spacing) * rel_grid_spacing;
            m_y = Math.round(m_y / rel_grid_spacing) * rel_grid_spacing;
        }

        set_cursor_override(null);

        // console.log(m_x, m_y);
        if (item_placing == "charge") {

            function finalize(input) {
                if (input === null) {
                    // User pressed cancel
                    is_placing = false;
                    return;
                }

                let unit = "e"
                if (input.endsWith("C")) {
                    unit = "C";
                }
                let charge = parseFloat(input.replaceAll("C", "").replaceAll("e", ""), 10);



                if (isNaN(charge) || charge == 0) {
                    // Invalid number input
                    is_placing = false;
                    return;
                }

                let q_coulomb = charge;
                if (unit == "e") {
                    q_coulomb *= ELEMENTARY_CHARGE;
                }

                add_charge(m_x, m_y, q_coulomb);
                calculate_frame();
                is_placing = false;
                add_state(`Place ${item_placing}`)
            }
            popup_prompt("Enter charge: [ End on C (Coulomb) or e (Elementary charge) -> Default is e ]", finalize);
        }
        if (item_placing == "sensor") {
            let id = (new Date).getTime();
            sensors[id] = {
                id: `sensor-${id}`,
                type: "sensor",
                x: m_x,
                y: m_y
            }
            calculate_frame();
            is_placing = false;
            add_state(`Place ${item_placing}`)
        }
        if (item_placing == "arrow") {
            let id = (new Date).getTime();
            sensors[id] = {
                id: `arrow-${id}`,
                type: "arrow",
                x: m_x,
                y: m_y
            }
            calculate_frame();
            is_placing = false;
            add_state(`Place ${item_placing}`)
        }

    }
}

function handleMouseMove(e) {
    mouse_position_local = get_local_mouse_pos(e);
    mouse_position_global = get_global_mouse_pos(e);

    // if we're not dragging, just exit
    if (!isDown) { return; }

    // tell the browser we'll handle this event
    e.preventDefault();
    e.stopPropagation();

    // get the current mouse position
    mouseX = parseInt(e.clientX - offsetX);
    mouseY = parseInt(e.clientY - offsetY);

    // calculate how far the mouse has moved
    // since the last mousemove event was processed
    var dx = mouseX - lastX;
    var dy = mouseY - lastY;

    // reset the lastX/Y to the current mouse position
    lastX = mouseX;
    lastY = mouseY;

    cam.last_x = cam.x;
    cam.last_y = cam.y;

    cam.x += dx;
    cam.y += dy;

    render_image();
}

function get_local_mouse_pos(e) {
    return {
        x: parseInt((e.pageX - cam.x) / cam.zoom),
        y: parseInt((e.pageY - cam.y) / cam.zoom)
    }
}

function toggle_pinpoint() {
    is_placing = false;
    is_measuring = false;
    is_picking = !is_picking;
    if (is_picking) {
        set_cursor_override("crosshair");
    }
    else {
        set_cursor_override(null);
    }
}


function get_global_mouse_pos(e) {
    return {
        x: e.pageX,
        y: e.pageY
    }
}

function handle_scroll(e) {
    e.preventDefault();

    const mouse = {
        x: e.offsetX,
        y: e.offsetY
    };

    // Convert screen → world coordinates BEFORE zoom
    const worldPosBefore = {
        x: (mouse.x - cam.x) / cam.zoom,
        y: (mouse.y - cam.y) / cam.zoom
    };

    let zoomFactor = Math.exp(-e.deltaY * 0.001);

    let newZoom = cam.zoom * zoomFactor;

    // Clamp zoom
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

    cam.zoom = newZoom;

    // Convert world → screen AFTER zoom
    const worldPosAfter = {
        x: worldPosBefore.x * cam.zoom + cam.x,
        y: worldPosBefore.y * cam.zoom + cam.y
    };

    // Adjust camera so mouse stays fixed
    cam.x += mouse.x - worldPosAfter.x;
    cam.y += mouse.y - worldPosAfter.y;

    render_image();
}

// Key down → add key if not already in array
window.addEventListener("keydown", (event) => {
    const key = event.key;

    if (key == "Escape") {
        is_placing = false;
        item_placing = false;
        is_measuring = false;
        is_picking = false;
        measurement = null;
        selected_object = null;
        set_cursor_override(null);
        $("#inspector").innerHTML = `
            <i>No object selected</i>
        `;

        close_popup();
        close_small_popup();
    }

    if (pressed_keys.includes("Control")) {
        if (key == "z") {
            undo();
        }
        if (key == "y") {
            redo();
        }
    }

    if (!pressed_keys.includes(key)) {
        pressed_keys.push(key);
    }
});

// Key up → remove key from array
window.addEventListener("keyup", (event) => {
    const key = event.key;

    pressed_keys = pressed_keys.filter(k => k !== key);
});

// FPS
let fps = 0;
let last_fps = 0;
let rendered_frames = 0;
function update_fps() {
    last_fps = fps;
    fps = rendered_frames;
    if (fps == 67 || fps == 69) {
        fps = 68;
    };
    rendered_frames = 0;

    draw_indicators();
};


function draw_text(text, x, y, font_size, clear_bg = true, centered = false) {
    ctx.font = `${font_size} monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    if (centered) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
    }

    if (clear_bg) {
        // measure text width
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = 14; // approximate for 12pt font

        // clear a rectangle behind the text (add padding)
        if (centered) {
            ctx.clearRect(
                x - (textWidth / 2) - 4,   // left
                y - (textHeight / 2) - 4,  // top
                textWidth + 8,       // width
                textHeight + 8       // height
            );
        }
        else {
            ctx.clearRect(
                x - textWidth - 4,   // left
                y - textHeight - 4,  // top
                textWidth + 8,       // width
                textHeight + 8       // height
            );
        }
    }

    // draw text
    ctx.fillText(text, x, y);
}

function draw_indicators() {
    ctx.font = "12pt monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";

    const text = `${fps} FPS`;
    const beforetext = `${last_fps} FPS`;

    // measure text width
    const metrics = ctx.measureText(beforetext);
    const textWidth = metrics.width;
    const textHeight = 14; // approximate for 12pt font

    const x = canvas.width - 10;
    const y = canvas.height - 10;

    // clear a rectangle behind the text (add padding)
    ctx.clearRect(
        x - textWidth - 4,   // left
        y - textHeight - 4,  // top
        textWidth + 8,       // width
        textHeight + 8       // height
    );

    // draw text
    ctx.fillText(text, x, y);

    let y_off = 20;

    let indicators = []

    hover_details.forEach(element => {
        indicators.push(element);
    });;

    if (is_measuring) {
        indicators.push("Measuring");
    }
    if (is_picking) {
        indicators.push("Pinpoint");
    }
    if (is_placing) {
        indicators.push(`Placing ${item_placing}`);
    }

    indicators.forEach(text => {
        const x = canvas.width - 10;
        const y = canvas.height - 10 - y_off;

        draw_text(text, x, y, "12pt", true)

        y_off += 20;
    });

}



let r = 0;
function rotate_loading_screen() {
    r += 0.002
    $("#loading_img").style.transform = `rotate(${r}turn)`;
}

let loading_interval = null

function reset_camera() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    cam.last_x = canvas.width / 1.6;
    cam.x = canvas.width / 1.6;
    cam.last_y = canvas.height / 2;
    cam.y = canvas.height / 2;

    cam.zoom = 1;
    render_image();
}

// Initialisation
async function init() {
    canvas = $("#simulation_canvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    cam.last_x = canvas.width / 1.6;
    cam.x = canvas.width / 1.6;
    cam.last_y = canvas.height / 2;
    cam.y = canvas.height / 2;
    canvas.onpointerdown = function (e) { handleMouseDown(e); };
    canvas.onpointermove = function (e) { handleMouseMove(e); };
    canvas.onpointerup = function (e) { handleMouseUp(e); };
    // canvas.onmouseout = function (e) { handleMouseUp(e); };

    canvas.onwheel = function (e) { handle_scroll(e); };
    ctx = canvas.getContext("2d");

    playpause_sim = $("#play_pause_sim");
    playpause_rec = $("#play_pause_rec");
    toggle_grid = $("#grid_toggle");
    toggle_lines = $("#field_toggle");
    target = $("#target_icon");


    let hash = document.location.hash;

    if (hash != "") {
        $("#loading_progress").textContent = `Loading simulation ${hash}`;
        await enter_code(hash.replaceAll("#", ""));
    }
    else {
        if (localStorage.getItem("visualelectric_autosave") != null) {
            $("#loading_progress").textContent = `Loading simulation from cache`;
            await delay(1000);
            load_simulation(JSON.parse(localStorage.getItem("visualelectric_autosave")));
        }
    }

    render_image();
    clearInterval(loading_interval);
    $("#splash_screen").style.display = "none";
    setInterval(render_image, 1000 / 60);
    setInterval(update_fps, 1000);
}
window.onresize = init;

function increment() {
    loadedCount++;
    console.log(`Loaded ${loadedCount}/${images.length}`)
    if (loadedCount === images.length) {
        init();
    }
}

function show_stuff() {
    loading_interval = setInterval(rotate_loading_screen, 1 / 60);

    document.querySelectorAll(".get_vid").forEach(element => {
        element.innerHTML = element.innerHTML.replaceAll("{VID}", version_code)
    });

    $("#splash_screen_2").style.display = "none";
}

let loadedCount = 0;
let images = [];

document.addEventListener("DOMContentLoaded", () => {
    let hint_i = Math.floor(Math.random() * hints.length - 0.001);
    $("#hint").textContent = hints[hint_i];

    images = document.querySelectorAll("img");

    images.forEach(img => {
        // If already cached/loaded
        if (img.complete) {
            increment();
        } else {
            img.addEventListener("load", increment);
            img.addEventListener("error", increment); // optional, avoids hanging
        }
    });

    // load assets
    image_charge = document.getElementById("btn_charge")
    image_sensor = document.getElementById("btn_sensor")
})