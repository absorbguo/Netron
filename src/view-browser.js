/*jshint esversion: 6 */

class BrowserHost {

    constructor() {
        if (!window.ga) {
            window.GoogleAnalyticsObject = 'ga';
            window.ga = window.ga || function() {
                window.ga.q = window.ga.q || [];
                window.ga.q.push(arguments);
            };
            window.ga.l = 1 * new Date();
        }
        window.ga('create', 'UA-54146-12', 'auto');

        window.addEventListener('error', (e) => {
            this.exception(e.error, true);
        });
    }

    get name() {
        return 'Netron';
    }

    get version() {
        return this._version;
    }

    get type() {
        return this._type;
    }

    initialize(view) {
        this._view = view;

        window.addEventListener('keydown', (e) => {
            this._keyHandler(e);
        });

        var meta = {};
        Array.from(document.getElementsByTagName('meta')).forEach((element) => {
            if (element.content) {
                meta[element.name] = meta[element.name] || [];
                meta[element.name].push(element.content);
            }
        });

        this._version = meta.version ? meta.version[0] : '0.0.0';
        this._type = meta.type ? meta.type[0] : 'Browser';

        if (meta.file) {
            this._openModel('/data', meta.file[0].split('/').pop());
            return;
        }

        var urlParam = this._getQueryParameter('url');
        if (urlParam) {
            this._openModel(urlParam, this._getQueryParameter('identifier') || urlParam.split('/').pop());
            return;
        }

        this._view.show('Welcome');
        var openFileButton = document.getElementById('open-file-button');
        var openFileDialog = document.getElementById('open-file-dialog');
        if (openFileButton && openFileDialog) {
            openFileButton.addEventListener('click', (e) => {
                openFileDialog.value = '';
                openFileDialog.click();
            });
            openFileDialog.addEventListener('change', (e) => {
                if (e.target && e.target.files && e.target.files.length == 1) {
                    this._openFile(e.target.files[0]);
                }
            });
        }
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        document.addEventListener('drop', (e) => {
            e.preventDefault();
        });
        document.body.addEventListener('drop', (e) => { 
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length == 1) {
                this._openFile(e.dataTransfer.files[0]);
            }
            return false;
        });
    }

    error(message, detail) {
        alert(message + ' ' + detail);
    }

    confirm(message, detail) {
        return confirm(message + ' ' + detail);
    }

    import(file, callback) {
        var url = this._url(file);
        for (var i = 0; i < document.scripts.length; i++) {
            if (url == document.scripts[i]) {
                callback(null);
                return;
            }
        }
        var script = document.createElement('script');
        script.onload = () => {
            callback(null);
        };
        script.onerror = (e) => {
            callback(new Error('The script \'' + e.target.src + '\' failed to load.'));
        };
        script.setAttribute('type', 'text/javascript');
        script.setAttribute('src', url);
        document.head.appendChild(script);
    }

    export(file, data, mimeType) {
    }

    request(file, callback) {
        var url = this._url(file);
        var request = new XMLHttpRequest();
        if (file.endsWith('.pb')) {
            request.responseType = 'arraybuffer';
        }
        request.onload = () => {
            if (request.status == 200) {
                if (request.responseType == 'arraybuffer') {
                    callback(null, new Uint8Array(request.response));
                }
                else {
                    callback(null, request.responseText);
                }
            }
            else {
                callback(request.status, null);
            }
        };
        request.onerror = () => {
            callback(request.status, null);
        };
        request.open('GET', url, true);
        request.send();
    }

    openURL(url) {
        window.open(url, '_target');
    }

    exception(err, fatal) {
        if (window.ga) {
            var description = [];
            description.push((err.name ? (err.name + ': ') : '') + err.message);
            if (err.stack) {
                var match = err.stack.match(/\n    at (.*)\((.*)\)/);
                if (match) {
                    description.push(match[1] + '(' + match[2].split('/').pop() + ')');
                }
                else {
                    description.push(err.stack.split('\n').shift());
                }
            }
            window.ga('send', 'exception', {
                exDescription: description.join(' @ '),
                exFatal: fatal,
                appName: this.type,
                appVersion: this.version
            });
        }
    }

    screen(name) {
        if (window.ga) {
            window.ga('send', 'screenview', {
                screenName: name,
                appName: this.type,
                appVersion: this.version
            });
        }
    }

    event(category, action, label, value) {
        if (window.ga) {
            window.ga('send', 'event', {
                eventCategory: category,
                eventAction: action,
                eventLabel: label,
                eventValue: value,
                appName: this.type,
                appVersion: this.version
            });
        }
    }

    _url(file) {
        var url = file;
        if (window && window.location && window.location.href) {
            var location = window.location.href.split('?').shift();
            if (location.endsWith('/')) {
                location = location.slice(0, -1);
            }
            url = location + file;
        }
        return url;
    }

    _getQueryParameter(name) {
        var url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
        var results = regex.exec(url);
        if (!results) {
            return null;
        }
        if (!results[2]) {
            return '';
        }
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    _openModel(url, file) {
        this._view.show('Spinner');
        var request = new XMLHttpRequest();
        request.responseType = 'arraybuffer';
        request.onload = () => {
            if (request.status == 200) {
                var buffer = new Uint8Array(request.response);
                this._view.openBuffer(buffer, file, (err, model) => {
                    this._view.show(null);
                    if (err) {
                        this.exception(err, false);
                        this.error(err.name, err.message);
                    }
                    if (model) {
                        document.title = file;
                    }
                });
            }
            else {
                this.error('Model load request failed.', request.status);
            }
        };
        request.onerror = () => {
            this.error('Error while requesting model.', request.status);
        };
        request.open('GET', url, true);
        request.send();
    }

    _openFile(file) {
        this._view.show('Spinner');
        this._openBuffer(file, (err, model) => {
            this._view.show(null);
            if (err) {
                this.exception(err, false);
                this.error(err.name, err.message);
            }
            if (model) {
                document.title = file.name;
            }
        });
    }

    _openBuffer(file, callback) {
        var size = file.size;
        var reader = new FileReader();
        reader.onloadend = () => {
            if (reader.error) {
                callback(reader.error, null);
                return;
            }
            var buffer = new Uint8Array(reader.result);
            this._view.openBuffer(buffer, file.name, (err, model) => {
                callback(err, model);
            });
        };
        reader.readAsArrayBuffer(file);
    }

    _keyHandler(e) {
        if (!e.altKey && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
            switch (e.keyCode) {
                case 70: // F
                    this._view.find();
                    e.preventDefault();
                    break;
                case 68: // D
                    this._view.toggleDetails();
                    e.preventDefault();
                    break;
                case 85: // U
                    this._view.toggleNames();
                    e.preventDefault();
                    break;
                case 13: // Return
                    document.getElementById('model-properties-button').click();
                    e.preventDefault();
                    break;
                case 8: // Backspace
                    this._view.resetZoom();
                    e.preventDefault();
                    break;
                case 38: // Up
                    document.getElementById('zoom-in-button').click();
                    e.preventDefault();
                    break;
                case 40: // Down
                    document.getElementById('zoom-out-button').click();
                    e.preventDefault();
                    break;
            }
        }
    }
}

window.TextDecoder = window.TextDecoder || class {
    constructor(encoding) {
        this._encoding = encoding;
    }
    decode(buffer) {
        var result = '';
        var length = buffer.length;
        var i = 0;
        switch (this._encoding) {
            case 'utf-8':
                while (i < length) {
                    var c = buffer[i++];
                    switch(c >> 4)
                    { 
                        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                            result += String.fromCharCode(c);
                            break;
                        case 12: case 13:
                            c2 = buffer[i++];
                            result += String.fromCharCode(((c & 0x1F) << 6) | (c2 & 0x3F));
                            break;
                        case 14:
                            var c2 = buffer[i++];
                            var c3 = buffer[i++];
                            result += String.fromCharCode(((c & 0x0F) << 12) | ((c2 & 0x3F) << 6) | ((c3 & 0x3F) << 0));
                            break;
                    }
                }
                break;
            case 'ascii':
                while (i < length) {
                    result += String.fromCharCode(buffer[i++]);
                }
                break;
        }
        return result;
    }
};

window.host = new BrowserHost();
