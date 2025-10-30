// Simulation objects
charges = [];
sensors = {};
rigidbodies = {};


// Physical constants
const k = 8.854187812813 * 10 ** (-12);

// UI shortcuts
let canvas = null;
let playpause_sim = null;
let playpause_rec = null;
let toggle_grid = null;
let toggle_lines = null;

// UI settings
let grid_active = true;
let field_lines_active = true;

// Editor
let is_placing = false;
let item_placing = null;

// Objects
let arrow_width = 4;
let arrow_tip_width = 15;
let arrow_tip_length = 40;

// Grid
let grid_spacing = 100;
let point_radius = 2;

// Lines
let line_width = 2;

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
const minZoom = 0.3;
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
let image_charge = document.getElementById("btn_charge")
let image_sensor = document.getElementById("btn_sensor")

// General helper functions
function $(query) {
    return document.querySelector(query);
}

// Math helper functions
function rad_to_deg(radians) {
    return radians * (180 / Math.PI);
}

function deg_to_rad(deg) {
    return deg / 180 * Math.PI;
}

function get_angle(diff_x, diff_y) {
    let angle = 0;
    if (diff_x == 0) { // Verticals
        if (diff_y > 0) {
            angle = deg_to_rad(90);
        }
        if (diff_y < 0) {
            angle = deg_to_rad(270);
        }
    }
    else {
        angle = Math.atan(diff_y / diff_x);

        // Change angle according to quadrant
        if (diff_x > 0) {
            if (diff_y > 0) {   // LOWER RIGHT
                angle = deg_to_rad(360) + angle;
            }
            else {              // LOWER RIGHT
                angle = angle;
            }
        }
        else {
            if (diff_y > 0) {   // LOWER LEFT
                angle = deg_to_rad(180) + angle;
            }
            else {              // UPPER LEFT
                angle = deg_to_rad(180) + angle;
            }
        }
    }
    return angle;
}


// Physics engine functions
function add_charge(x, y, q) {
    id = charges.length;
    charges.push({
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
            console.log(`Point: ${charge.id}\n${x}, ${y}\nCharge: ${q}`);
        }

        let diff_x = (charge.x - scan_x) / 100;
        let diff_y = (charge.y - scan_y) / 100;

        let distance = Math.sqrt(diff_x ** 2 + diff_y ** 2);

        let angle = get_angle(diff_x, diff_y);
        if (debug) {
            console.log(`Calculated angle: ${rad_to_deg(angle)} deg`);
        }
        let strength = k + (q / distance ** 2);

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
    ctx.moveTo(parseInt(start_vec2.x), parseInt(start_vec2.y));
    ctx.lineTo(parseInt(end_vec2.x), parseInt(end_vec2.y));
    ctx.stroke();
}

function draw_arrow(start_vec2, speed_vec2, color = "white") {
    console.log(`Drawing arrow\npos: ${start_vec2.x}, ${start_vec2.y}\nvec: ${speed_vec2.x}, ${speed_vec2.y}`)
    let angle = get_angle(speed_vec2.x, speed_vec2.y);
    let value = Math.sqrt(speed_vec2.x ** 2 + speed_vec2.y ** 2);

    let tip = {
        x: start_vec2.x + speed_vec2.x,
        y: start_vec2.y + speed_vec2.y
    };

    let tl = arrow_tip_length;
    if (tl > value / 2) {
        tl = value / 2;
    }
    let tw = arrow_tip_width
    if (tw > value / 3) {
        tw = value / 3;
    }

    let left_line_outer = {
        x: start_vec2.x + (Math.cos(angle) * (value - tl)),
        y: start_vec2.y + (Math.sin(angle) * (value - tl))
    };
    left_line_outer.x += Math.cos(angle - deg_to_rad(90)) * tw;
    left_line_outer.y += Math.sin(angle - deg_to_rad(90)) * tw;

    let right_line_outer = {
        x: start_vec2.x + (Math.cos(angle) * (value - tl)),
        y: start_vec2.y + (Math.sin(angle) * (value - tl))
    };
    right_line_outer.x += Math.cos(angle + deg_to_rad(90)) * tw;
    right_line_outer.y += Math.sin(angle + deg_to_rad(90)) * tw;

    ctx.beginPath();
    ctx.lineWidth = arrow_width;
    ctx.strokeStyle = color;
    ctx.moveTo(start_vec2.x, start_vec2.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left_line_outer.x, left_line_outer.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(right_line_outer.x, right_line_outer.y);
    ctx.stroke();



    // ctx.beginPath();
    // ctx.lineWidth = arrow_width;
    // ctx.strokeStyle = color;
    // ctx.moveTo(start_vec2.x, start_vec2.y);
    // ctx.lineTo(tip.x, tip.y);
    // ctx.stroke();
}

function render_image() {
    if (cam.z == 0) {
        console.error("Camera zoom is 0, unable to calculate.")
        return
    }

    smoothen_camera();

    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)



    if (grid_active) {
        // Draw grid points
        let rel_gs = grid_spacing * cam.zoom

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
                    draw_point(x, y, point_radius * cam.zoom * 2);
                }
                else {
                    draw_point(x, y, point_radius * cam.zoom);
                }
            }
        }
    }

    render.forEach(render_element => {
        if (render_element.type == "line") {
            draw_line(to_local(render_element.p1), to_local(render_element.p2), render_element.color);
        }
        if (render_element.type == "arrow") {
            let fs = {
                x: render_element.vec.x * cam.zoom * 100,
                y: render_element.vec.y * cam.zoom * 100
            };
            // draw_point(to_local(render_element.p).x,to_local(render_element.p).y,10,"red")
            draw_arrow(to_local(render_element.p), fs);
        }
        if (render_element.type == "image") {
            ctx.drawImage(render_element.image, (to_local(render_element.p).x) - 20, (to_local(render_element.p).y) - 20)
        }
    });
}

function calculate_frame(physics = false) {

    render = [];
    // Draw charge icons
    charges.forEach(charge => {
        // console.log(`Rendering charge at\nx: ${charge.x}\ny: ${charge.y}\n===\nThat is on screen:\nx_onscreen: ${(charge.x - 16) * cam.zoom - cam.x}\ny_onscreen: ${(charge.y - 16) * cam.zoom - cam.y}`);
        let pos = charge

        if (field_lines_active) {
            spreads = [
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
            spreads.forEach(s => {

                let l_x = charge.x + Math.cos(s);
                let l_y = charge.y + Math.sin(s);
                let l_t = "positive";
                let l_g = "negative";
                if (charge.q < 0) {
                    l_t = "negative";
                    l_g = "positive";
                }
                console.log(l_g);
                let j = 0;

                let done = false;
                while (!done) {
                    if (get_nearest_charge(l_x, l_y, l_g).distance < 1 || j > 2000) {
                        done = true;
                    }
                    if (get_nearest_charge(l_x, l_y, l_g).distance == Infinity && j > 200) {
                        done = true;
                    }

                    let f = get_charge_at_point(l_x, l_y);
                    let angle = f.angle;
                    if (l_t == "positive") {
                        angle = f.angle + deg_to_rad(180);
                    }

                    p1 = {
                        x: l_x,
                        y: l_y
                    };
                    let v = 15;
                    if (v > get_nearest_charge(l_x, l_y, l_g).distance) {
                        v = get_nearest_charge(l_x, l_y, l_g).distance;
                    }
                    console.log(`V: ${v}\nAngle: ${rad_to_deg(angle)}deg\nTranslate: ${Math.cos(angle) * v}, ${Math.sin(angle) * v}`)
                    l_x += Math.cos(angle) * v;
                    l_y += Math.sin(angle) * v;
                    p2 = {
                        x: l_x,
                        y: l_y
                    };
                    console.log(p2);
                    render.push({
                        type: "line",
                        p1: p1,
                        p2: p2,
                        color: `white`
                    })
                    j++;
                }
            });
        }

        render.push({
            type: "image",
            p: {
                x: pos.x,
                y: pos.y
            },
            image: image_charge
        });
    });

    // Draw sensors and arrows
    Object.keys(sensors).forEach(sensor_key => {
        let sensor = sensors[sensor_key];
        let fs = get_charge_at_point(sensor.x, sensor.y, true);
        let spos = sensor;

        // draw_point(spos.x,spos.y,10,"red");
        // draw_point(spos.x+fs.x,spos.y+fs.y,5,"blue");
        if (sensor.type == "arrow") {
            render.push({
                type: "arrow",
                p: spos,
                vec: fs
            });
        }
        else if (sensor.type == "sensor") {
            render.push({
                type: "image",
                p: {
                    x: spos.x,
                    y: spos.y
                },
                image: image_sensor
            })
        }
    });
}


// UI Interactions

function clear_canvas() {
    charges = [];
    sensors = {};
    rigidbodies = {};
    calculate_frame();
    render_image();
}

function toggle_setting(setting) {
    if (setting == "grid") {
        grid_active = !grid_active;
        if (grid_active) {
            toggle_grid.src = "static/img/grid_toggle.svg";
        }
        else {
            toggle_grid.src = "static/img/no_grid.svg";
        }
    }
    else if (setting == "lines") {
        field_lines_active = !field_lines_active;
        if (field_lines_active) {
            toggle_lines.src = "static/img/lines.svg";
        }
        else {
            toggle_lines.src = "static/img/no_lines.svg"
        }
    }
    calculate_frame();
    render_image();
}

function place_object(object) {
    is_placing = true;
    item_placing = object;
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

    isDown = true;
}

function handleMouseUp(e) {
    // tell the browser we'll handle this event
    e.preventDefault();
    e.stopPropagation();

    // stop the drag
    isDown = false;

    if (is_placing) {
        let m_x = get_local_mouse_pos(e).x;
        let m_y = get_local_mouse_pos(e).y;
        console.log(m_x, m_y);
        if (item_placing == "charge") {

            let charge = parseInt(prompt("Enter charge in elemtary charge:"));
            if (charge == null || charge == NaN) { return; }
            add_charge(m_x, m_y, charge);
        }
        if (item_placing == "sensor") {
            let id = Object.keys(sensors).length;
            sensors[id] = {
                type: "sensor",
                x: m_x,
                y: m_y
            }
        }
        if (item_placing == "arrow") {
            let id = Object.keys(sensors).length;
            sensors[id] = {
                type: "arrow",
                x: m_x,
                y: m_y
            }
        }
        calculate_frame();
        render_image();
        is_placing = false;
    }
}

function handleMouseMove(e) {
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

function handle_scroll(e) {
    let p = get_local_mouse_pos(e);

    let mod = 1;

    if (e.deltaY > 0) {
        mod = 0.9;
    }
    else if (e.deltaY < 0) {
        mod = 1.1;
    }

    if (cam.zoom < minZoom && mod < 1) {
        mod = 1;
    }
    if (cam.zoom > maxZoom && mod > 1) {
        mod = 1;
    }

    if (e.shiftKey) {
        mod /= 2;
    }

    p2 = {
        x: p.x * mod,
        y: p.y * mod
    }

    cam.zoom *= mod;
    // cam.x += p.x+p2.x;
    // cam.y += p.y+p2.y;    

    render_image();
}

// Initialisation
function init() {
    canvas = $("#simulation_canvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    cam.last_x = canvas.width / 1.6;
    cam.x = canvas.width / 1.6;
    cam.last_y = canvas.height / 2;
    cam.y = canvas.height / 2;
    canvas.onmousedown = function (e) { handleMouseDown(e); };
    canvas.onmousemove = function (e) { handleMouseMove(e); };
    canvas.onmouseup = function (e) { handleMouseUp(e); };
    canvas.onmouseout = function (e) { handleMouseUp(e); };
    canvas.onwheel = function (e) { handle_scroll(e); };
    ctx = canvas.getContext("2d");

    playpause_sim = $("#play_pause_sim");
    playpause_rec = $("#play_pause_rec");
    toggle_grid = $("#grid_toggle");
    toggle_lines = $("#field_toggle");

    render_image();
}

window.onload = init;

window.onresize = init;