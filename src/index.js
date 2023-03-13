const env = require('dotenv').config();
const process = require('process');
const fs = require('fs');
const path = env.parsed.INI_PATH;
const errorLogPath = './logs/errors.log';
fs.exists(path, function (doesExist) {
    if (!doesExist) process.exit();
});
const URL = env.parsed.SOCKET_CLIENT_URL;
const PORT = env.parsed.SOCKET_CLIENT_PORT;
const RSSH_PORT = env.parsed.RSSH_PORT;
const socket = require('socket.io-client')(`${URL}:${PORT}`);
const { execSync } = require("child_process");
const ping = require('ping');
const ini = require('ini');
const temp_device_id = parseInt(parseIni(path, 'temp_device_id'));
const pid_info = env.parsed.PID_INFO;
const host = '8.8.8.8';
const frequency = 3000;
const RETRY_INTERVAL = 10000;
let connected = false;
let fileDataText;
let i = 0;
let timeout;
let startTime;
let uid;
let jsonData;

// MULTIPLE PLACE USE
function run(cwd, command) {
    try {
        return execSync(command, { cwd, encoding: "utf8" });
    } catch (err) {
        readAndWrite('write', err);
        console.log(err);
    }
}

try {
    if (fs.existsSync(path)) {

        if (fs.existsSync(pid_info)) {
            fs.readFile(pid_info, 'utf8', (err, oldPid) => {
                if (err) {
                    readAndWrite('write', err);
                    console.error(err);
                    return
                }
                // process.kill(process.pid)
            });
        } else {
            fs.writeFile(pid_info, parseInt(process.pid, 10).toString(), function (err) {
                if (err) {
                    readAndWrite('write', err);
                    return console.log(err);
                }
            });
        }
    }
} catch (err) {
    readAndWrite('write', err);
    console.error(err)
}

socket.on('connect', () => {
    console.log('=== start chatting ===');
    connected = true;
    clearTimeout(timeout);
});

socket.on('disconnect', function () {
    connected = false;
    console.log("call retry func");
    retryConnectOnFailure(RETRY_INTERVAL);

});

var retryConnectOnFailure = function (retryInMilliseconds) {
    setTimeout(function () {
        if (!connected) {
            connected = true;
            retryConnectOnFailure(retryInMilliseconds);
            console.log("reconnection");
        }
    }, retryInMilliseconds);
}

socket.on('pongs', function () {
    latency = Date.now(); - startTime;
    console.log(latency);
});

// FUNCTIONS
function parseIni(path, key) {
    try {
        if (fs.existsSync(path)) {

            var config = ini.parse(fs.readFileSync(path, 'utf8', (err) => {
                if (err) {
                    readAndWrite('write', err);
                    console.log(err);
                    return
                }
            }));

            return (config[key]);
        }

    } catch (error) {
        readAndWrite('write', error);
        console.log(error);
    }
}

function checkStatus() {

    ping.sys.probe(host, function (isAlive) {
        let msg = isAlive ? 'online' : 'offline';
        let date = new Date();
        let time = date.getTime();
        const rssh = rsshport();
        const driverStatus = checkDriverInstallation();
        const applicationStatus = checkApplicationInstallation();
        const lcdStatus = checkLCDInstallation();

        jsonData = { uid, msg, time };

        if (rssh) {
            jsonData = { ...jsonData, rssh };
        }
        if (driverStatus) {
            jsonData = { ...jsonData, driverStatus };
        }
        if (applicationStatus) {
            jsonData = { ...jsonData, applicationStatus };
        }
        if (lcdStatus) {
            jsonData = { ...jsonData, lcdStatus };
        }

        if (isAlive) {
            socket.emit('device_rssh', jsonData, function (confirm) {
                console.log(confirm);
            });
        } else {
            socket.on('disconnect', function () {
                socket.emit('connectionLoss')
            });
        }

        i++;
    });
}

function checkDriverInstallation(cwd) {
    let output = run(cwd, "lsmod | grep -i spi_arduino");
    output = output ? output.trim().split(/\s+/) : "";
    if (output.length > 0 && output.includes("spi_arduino")) {
        return output[0];
    }
    return false;
}

function checkApplicationInstallation() {
    let path = '/tmp/emtlogs';
    try {
        if (fs.existsSync(path)) {
            readAndWrite('write', 'Application');
            readAndWrite('read');
            if (fileDataText) return true
        }
    } catch (err) {
        readAndWrite('write', err);
        console.error(err)
    }

    return false;
}

function checkLCDInstallation() {
    let path = '/bin/lcd';
    try {
        if (fs.existsSync(path)) {
            return true
        }
    } catch (err) {
        readAndWrite('write', err);
        console.error(err)
    }

    return false;
}


if (fs.existsSync(path)) {
    try {
        if (temp_device_id) {
            socket.connect();
            uid = temp_device_id;
            setInterval(function () {
                startTime = Date.now();
                checkStatus();
            }, frequency);
        }
    } catch (error) {
        console.log("error", error);
    }

}

function rsshport(cwd) {
    let output = run(cwd, `cat ${RSSH_PORT}`);
    return output;
}

retryConnectOnFailure(RETRY_INTERVAL);
function readAndWrite(type, content = "") {
    if (type == 'read') {
        fs.readFile(errorLogPath, 'utf8', (err, data) => {
            if (err) {
                // fs.appendFileSync('functionError.log', err);
                console.error(err);
                return;
            }
            fileData(data);
            return data;
        });
    }

    if (type == 'write') {
        try {
            const datenow = new Date();
            const dateToday = datenow.toISOString().replace("T", " ").substring(0, 19);
            const contentData = `[${dateToday}] ${content} \n`
            fs.appendFileSync(errorLogPath, contentData);
        } catch (err) {
            // fs.appendFileSync('functionError.log', err);
            console.error(err);
        }
    }
}

function fileData(data) {
    fileDataText = data
    return data;
}

function test(t) {
    console.log(t);
}

exports.test = test;