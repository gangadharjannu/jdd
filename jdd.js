/*******************************************************************************
 *
 * Copyright 2015-2017 Zack Grossbart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 ******************************************************************************/
'use strict';

/**
 * The jdd object handles all of the functions for the main page.  It finds the diffs and manages
 * the interactions of displaying them.
 */
/*global jdd:true */
var jdd = {

    LEFT: 'left',
    RIGHT: 'right',

    EQUALITY: 'eq',
    TYPE: 'type',
    MISSING: 'missing',
    diffs: [],
    requestCount: 0,

    /**
     * Find the differences between the two objects and recurse into their sub objects.
     */
    findDiffs: function (/*Object*/ config1, /*Object*/ data1, /*Object*/ config2, /*Object*/ data2) {
        config1.currentPath.push('/');
        config2.currentPath.push('/');

        var key;
        var val;

        if (data1.length < data2.length) {
            /*
             * This means the second data has more properties than the first.
             * We need to find the extra ones and create diffs for them.
             */
            for (key in data2) {
                if (data2.hasOwnProperty(key)) {
                    val = data1[key];
                    if (!data1.hasOwnProperty(key)) {
                        jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                            config2, jdd.generatePath(config2, '/' + key),
                            'The right side of this object has more items than the left side', jdd.MISSING));
                    }
                }
            }
        }

        /*
         * Now we're going to look for all the properties in object one and
         * compare them to object two
         */
        for (key in data1) {
            if (data1.hasOwnProperty(key)) {
                val = data1[key];

                config1.currentPath.push(key);

                if (!data2.hasOwnProperty(key)) {
                    /*
                     * This means that the first data has a property which
                     * isn't present in the second data
                     */
                    jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                        config2, jdd.generatePath(config2),
                        'Missing property <code>' + key + '</code> from the object on the right side', jdd.MISSING));
                } else {
                    config2.currentPath.push(key);

                    jdd.diffVal(data1[key], config1, data2[key], config2);
                    config2.currentPath.pop();
                }
                config1.currentPath.pop();
            }
        }

        config1.currentPath.pop();
        config2.currentPath.pop();

        /*
         * Now we want to look at all the properties in object two that
         * weren't in object one and generate diffs for them.
         */
        for (key in data2) {
            if (data2.hasOwnProperty(key)) {
                val = data1[key];

                if (!data1.hasOwnProperty(key)) {
                    jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                        config2, jdd.generatePath(config2, key),
                        'Missing property <code>' + key + '</code> from the object on the left side', jdd.MISSING));
                }
            }
        }
    },

    /**
     * Generate the differences between two values.  This handles differences of object
     * types and actual values.
     */
    diffVal: function (val1, config1, val2, config2) {

        if (_.isArray(val1)) {
            jdd.diffArray(val1, config1, val2, config2);
        } else if (_.isObject(val1)) {
            if (_.isArray(val2) || _.isString(val2) || _.isNumber(val2) || _.isBoolean(val2) || _.isNull(val2)) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be objects', jdd.TYPE));
            } else {
                jdd.findDiffs(config1, val1, config2, val2);
            }
        } else if (_.isString(val1)) {
            if (!_.isString(val2)) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be strings', jdd.TYPE));
            } else if (val1 !== val2) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both sides should be equal strings', jdd.EQUALITY));
            }
        } else if (_.isNumber(val1)) {
            if (!_.isNumber(val2)) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be numbers', jdd.TYPE));
            } else if (val1 !== val2) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both sides should be equal numbers', jdd.EQUALITY));
            }
        } else if (_.isBoolean(val1)) {
            jdd.diffBool(val1, config1, val2, config2);
        } else if (_.isNull(val1) && !_.isNull(val2)) {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be nulls', jdd.TYPE));
        }
    },

    /**
     * Arrays are more complex because we need to recurse into them and handle different length
     * issues so we handle them specially in this function.
     */
    diffArray: function (val1, config1, val2, config2) {
        if (!_.isArray(val2)) {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be arrays', jdd.TYPE));
            return;
        }

        if (val1.length < val2.length) {
            /*
             * Then there were more elements on the right side and we need to
             * generate those differences.
             */
            for (var i = val1.length; i < val2.length; i++) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2, '[' + i + ']'),
                    'Missing element <code>' + i + '</code> from the array on the left side', jdd.MISSING));
            }
        }
        _.each(val1, function (arrayVal, index) {
            if (val2.length <= index) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1, '[' + index + ']'),
                    config2, jdd.generatePath(config2),
                    'Missing element <code>' + index + '</code> from the array on the right side', jdd.MISSING));
            } else {
                config1.currentPath.push('/[' + index + ']');
                config2.currentPath.push('/[' + index + ']');

                if (_.isArray(val2)) {
                    /*
                     * If both sides are arrays then we want to diff them.
                     */
                    jdd.diffVal(val1[index], config1, val2[index], config2);
                }
                config1.currentPath.pop();
                config2.currentPath.pop();
            }
        });
    },

    /**
     * We handle boolean values specially because we can show a nicer message for them.
     */
    diffBool: function (val1, config1, val2, config2) {
        if (!_.isBoolean(val2)) {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be booleans', jdd.TYPE));
        } else if (val1 !== val2) {
            if (val1) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'The left side is <code>true</code> and the right side is <code>false</code>', jdd.EQUALITY));
            } else {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'The left side is <code>false</code> and the right side is <code>true</code>', jdd.EQUALITY));
            }
        }
    },

    /**
     * Format the object into the output stream and decorate the data tree with
     * the data about this object.
     */
    formatAndDecorate: function (/*Object*/ config, /*Object*/ data) {
        if (_.isArray(data)) {
            jdd.formatAndDecorateArray(config, data);
            return;
        }

        jdd.startObject(config);
        config.currentPath.push('/');

        var props = jdd.getSortedProperties(data);

        /*
         * If the first set has more than the second then we will catch it
         * when we compare values.  However, if the second has more then
         * we need to catch that here.
         */

        _.each(props, function (key) {
            config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + '"' + jdd.unescapeString(key) + '": ';
            config.currentPath.push(key);
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
            jdd.formatVal(data[key], config);
            config.currentPath.pop();
        });

        jdd.finishObject(config);
        config.currentPath.pop();
    },

    /**
     * Format the array into the output stream and decorate the data tree with
     * the data about this object.
     */
    formatAndDecorateArray: function (/*Object*/ config, /*Array*/ data) {
        jdd.startArray(config);

        /*
         * If the first set has more than the second then we will catch it
         * when we compare values.  However, if the second has more then
         * we need to catch that here.
         */

        _.each(data, function (arrayVal, index) {
            config.out += jdd.newLine(config) + jdd.getTabs(config.indent);
            config.paths.push({
                path: jdd.generatePath(config, '[' + index + ']'),
                line: config.line
            });

            config.currentPath.push('/[' + index + ']');
            jdd.formatVal(arrayVal, config);
            config.currentPath.pop();
        });

        jdd.finishArray(config);
        config.currentPath.pop();
    },

    /**
     * Generate the start of the an array in the output stream and push in the new path
     */
    startArray: function (config) {
        config.indent++;
        config.out += '[';

        if (config.paths.length === 0) {
            /*
             * Then we are at the top of the array and we want to add
             * a path for it.
             */
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
        }

        if (config.indent === 0) {
            config.indent++;
        }
    },

    /**
     * Finish the array, outdent, and pop off all the path
     */
    finishArray: function (config) {
        if (config.indent === 0) {
            config.indent--;
        }

        jdd.removeTrailingComma(config);

        config.indent--;
        config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + ']';
        if (config.indent !== 0) {
            config.out += ',';
        } else {
            config.out += jdd.newLine(config);
        }
    },

    /**
     * Generate the start of the an object in the output stream and push in the new path
     */
    startObject: function (config) {
        config.indent++;
        config.out += '{';

        if (config.paths.length === 0) {
            /*
             * Then we are at the top of the object and we want to add
             * a path for it.
             */
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
        }

        if (config.indent === 0) {
            config.indent++;
        }
    },

    /**
     * Finish the object, outdent, and pop off all the path
     */
    finishObject: function (config) {
        if (config.indent === 0) {
            config.indent--;
        }

        jdd.removeTrailingComma(config);

        config.indent--;
        config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + '}';
        if (config.indent !== 0) {
            config.out += ',';
        } else {
            config.out += jdd.newLine(config);
        }
    },

    /**
     * Format a specific value into the output stream.
     */
    formatVal: function (val, config) {
        if (_.isArray(val)) {
            config.out += '[';

            config.indent++;
            _.each(val, function (arrayVal, index) {
                config.out += jdd.newLine(config) + jdd.getTabs(config.indent);
                config.paths.push({
                    path: jdd.generatePath(config, '[' + index + ']'),
                    line: config.line
                });

                config.currentPath.push('/[' + index + ']');
                jdd.formatVal(arrayVal, config);
                config.currentPath.pop();
            });
            jdd.removeTrailingComma(config);
            config.indent--;

            config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + ']' + ',';
        } else if (_.isObject(val)) {
            jdd.formatAndDecorate(config, val);
        } else if (_.isString(val)) {
            config.out += '"' + jdd.unescapeString(val) + '",';
        } else if (_.isNumber(val)) {
            config.out += val + ',';
        } else if (_.isBoolean(val)) {
            config.out += val + ',';
        } else if (_.isNull(val)) {
            config.out += 'null,';
        }
    },

    /**
     * When we parse the JSON string we end up removing the escape strings when we parse it 
     * into objects.  This results in invalid JSON if we insert those strings back into the 
     * generated JSON.  We also need to look out for characters that change the line count 
     * like new lines and carriage returns.  
     * 
     * This function puts those escaped values back when we generate the JSON output for the 
     * well known escape strings in JSON.  It handles properties and values.
     *
     * This function does not handle unicode escapes.  Unicode escapes are optional in JSON 
     * and the JSON output is still valid with a unicode character in it.  
     */
    unescapeString: function (val) {
        if (val) {
            return val.replace('\\', '\\\\')    // Single slashes need to be replaced first
                .replace('\"', '\\"')     // Then double quotes
                .replace('\n', '\\n')     // New lines
                .replace('\b', '\\b')     // Backspace
                .replace('\f', '\\f')     // Formfeed
                .replace('\r', '\\r')     // Carriage return
                .replace('\t', '\\t');    // Horizontal tabs
        } else {
            return val;
        }
    },

    /**
     * Generate a JSON path based on the specific configuration and an optional property.
     */
    generatePath: function (config, prop) {
        var s = '';
        _.each(config.currentPath, function (path) {
            s += path;
        });

        if (prop) {
            s += '/' + prop;
        }

        if (s.length === 0) {
            return '/';
        } else {
            return s;
        }
    },

    /**
     * Add a new line to the output stream
     */
    newLine: function (config) {
        config.line++;
        return '\n';
    },

    /**
     * Sort all the relevant properties and return them in an alphabetical sort by property key
     */
    getSortedProperties: function (/*Object*/ obj) {
        var props = [];

        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                props.push(prop);
            }
        }

        props = props.sort(function (a, b) {
            return a.localeCompare(b);
        });

        return props;
    },

    /**
     * Generate the diff and verify that it matches a JSON path
     */
    generateDiff: function (config1, path1, config2, path2, /*String*/ msg, type) {
        if (path1 !== '/' && path1.charAt(path1.length - 1) === '/') {
            path1 = path1.substring(0, path1.length - 1);
        }

        if (path2 !== '/' && path2.charAt(path2.length - 1) === '/') {
            path2 = path2.substring(0, path2.length - 1);
        }

        var pathObj1 = _.find(config1.paths, function (path) {
            return path.path === path1;
        });

        var pathObj2 = _.find(config2.paths, function (path) {
            return path.path === path2;
        });

        if (!pathObj1) {
            throw 'Unable to find line number for (' + msg + '): ' + path1;
        }

        if (!pathObj2) {
            throw 'Unable to find line number for (' + msg + '): ' + path2;
        }

        return {
            path1: pathObj1,
            path2: pathObj2,
            type: type,
            msg: msg
        };
    },

    /**
     * Get the current indent level
     */
    getTabs: function (/*int*/ indent) {
        var s = '';
        for (var i = 0; i < indent; i++) {
            s += '    ';
        }

        return s;
    },

    /**
     * Remove the trailing comma from the output.
     */
    removeTrailingComma: function (config) {
        /*
         * Remove the trailing comma
         */
        if (config.out.charAt(config.out.length - 1) === ',') {
            config.out = config.out.substring(0, config.out.length - 1);
        }
    },

    /**
     * Create a config object for holding differences
     */
    createConfig: function () {
        return {
            out: '',
            indent: -1,
            currentPath: [],
            paths: [],
            line: 1
        };
    },

    /**
     * Format the output pre tags.
     */
    formatPRETags: function () {
        _.each($('pre'), function (pre) {
            var codeBlock = $('<pre class="codeBlock"></pre>');
            var lineNumbers = $('<div class="gutter"></div>');
            codeBlock.append(lineNumbers);

            var codeLines = $('<div></div>');
            codeBlock.append(codeLines);

            var addLine = function (line, index) {
                var div = $('<div class="codeLine line' + (index + 1) + '"></div>');
                lineNumbers.append($('<span class="line-number">' + (index + 1) + '.</span>'));

                var span = $('<span class="code"></span');
                span.text(line);
                div.append(span);

                codeLines.append(div);
            };

            var lines = $(pre).text().split('\n');
            _.each(lines, addLine);

            codeBlock.addClass($(pre).attr('class'));
            codeBlock.attr('id', $(pre).attr('id'));

            $(pre).replaceWith(codeBlock);
        });
    },
// TODO
    /**
     * Format the text edits which handle the JSON input
     */
    formatTextAreas: function () {
        _.each(document.createRange().createContextualFragment('textarea'), function (textarea) {
            var codeBlock = document.createRange().createContextualFragment('<div class="codeBlock"></div>');
            var lineNumbers = document.createRange().createContextualFragment('<div class="gutter"></div>');
            codeBlock.appendChild(lineNumbers);

            var addLine = function (line, index) {
                lineNumbers.append(document.createRange().createContextualFragment('<span class="line-number">' + (index + 1) + '.</span>'));
            };

            var lines = textarea.value.split('\n');
            _.each(lines, addLine);

            $(textarea).replaceWith(codeBlock);
            codeBlock.append(textarea);
        });
    },

    handleDiffClick: function (line, side) {
        var diffs = _.filter(jdd.diffs, function (diff) {
            if (side === jdd.LEFT) {
                return line === diff.path1.line;
            } else if (side === jdd.RIGHT) {
                return line === diff.path2.line;
            } else {
                return line === diff.path1.line || line === diff.path2.line;
            }
        });
        Array.prototype.forEach.call(document.querySelectorAll('pre.left span.code'), function (elem) {
            elem.classList.remove('selected');
        });
        Array.prototype.forEach.call(document.querySelectorAll('pre.right span.code'), function (elem) {
            elem.classList.remove('selected');
        });
        document.querySelector('ul.toolbar').textContent = '';

        _.each(diffs, function (diff) {
            document.querySelector('pre.left div.line' + diff.path1.line + ' span.code').classList.add('selected');
            document.querySelector('pre.right div.line' + diff.path2.line + ' span.code').classList.add('selected');
        });

        if (side === jdd.LEFT || side === jdd.RIGHT) {
            jdd.currentDiff = _.findIndex(jdd.diffs, function (diff) {
                return diff.path1.line === line;
            });
        }

        if (jdd.currentDiff === -1) {
            jdd.currentDiff = _.findIndex(jdd.diffs, function (diff) {
                return diff.path2.line === line;
            });
        }

        var buttons = document.createRange().createContextualFragment('<div id="buttons"><div>');
        var prev = document.createRange().createContextualFragment('<a href="#" title="Previous difference" class="disabled" id="prevButton">&lt;</a>');

        buttons.appendChild(prev);
        buttons.appendChild(document.createRange().createContextualFragment('<span id="prevNextLabel"></span>'));
        var next = document.createRange().createContextualFragment('<a href="#" title="Next difference" id="nextButton">&gt;</a>');
        buttons.appendChild(next);

        document.querySelector('ul.toolbar').appendChild(buttons);
        Array.prototype.slice.call(document.querySelector('ul.toolbar').querySelectorAll('a')).forEach(function (elem) {
            elem.addEventListener('click', function (evt) {
                evt.preventDefault();
                evt.target.id === 'nextButton' ? jdd.highlightNextDiff() : jdd.highlightPrevDiff();
            })
        });
        buttons.append(next);

        $('ul.toolbar').append(buttons);
        jdd.updateButtonStyles();

        jdd.showDiffDetails(diffs);
    },

    highlightPrevDiff: function () {
        if (jdd.currentDiff > 0) {
            jdd.currentDiff--;
            jdd.highlightDiff(jdd.currentDiff);
            jdd.scrollToDiff(jdd.diffs[jdd.currentDiff]);

            jdd.updateButtonStyles();
        }
    },

    highlightNextDiff: function () {
        if (jdd.currentDiff < jdd.diffs.length - 1) {
            jdd.currentDiff++;
            jdd.highlightDiff(jdd.currentDiff);
            jdd.scrollToDiff(jdd.diffs[jdd.currentDiff]);

            jdd.updateButtonStyles();
        }
    },

    updateButtonStyles: function () {
        document.getElementById('prevButton').classList.remove('disabled');
        document.getElementById('nextButton').classList.remove('disabled');

        $('#prevNextLabel').text((jdd.currentDiff + 1) + ' of ' + (jdd.diffs.length));

        if (jdd.currentDiff === 1) {
            document.getElementById('prevButton').classList.add('disabled');
        } else if (jdd.currentDiff === jdd.diffs.length - 1) {
            document.getElementById('nextButton').classList.add('disabled');
        }
    },

    /**
     * Highlight the diff at the specified index
     */
    highlightDiff: function (index) {
        jdd.handleDiffClick(jdd.diffs[index].path1.line, jdd.BOTH);
    },

    /**
     * Show the details of the specified diff
     */
    showDiffDetails: function (diffs) {
        _.each(diffs, function (diff) {
            var li = document.createRange().createContextualFragment('<li>' + diff.msg + '</li>');
            document.querySelector('ul.toolbar').appendChild(li);
            document.querySelector('ul.toolbar').addEventListener('click', function (event) {
                if (event && event.target.nodeName === 'LI') {
                    jdd.scrollToDiff(diff);
                }
            });
        });
    },

    // TODO
    /**
     * Scroll the specified diff to be visible
     */
    scrollToDiff: function (diff) {
        $('html, body').animate({
            scrollTop: $('pre.left div.line' + diff.path1.line + ' span.code').offset().top
        }, 0);
    },
    // TODO: 08082018
    /**
     * Process the specified diff
     */
    processDiffs: function () {
        var left = [];
        var right = [];

        _.each(jdd.diffs, function (diff, index) {
            document.querySelector('pre.left div.line' + diff.path1.line + ' span.code').classList.add(diff.type);
            document.querySelector('pre.left div.line' + diff.path1.line + ' span.code').classList.add('diff');
            if (_.indexOf(left, diff.path1.line) === -1) {
                document.querySelector('pre.left div.line' + diff.path1.line + ' span.code').addEventListener('click', function () {
                    jdd.handleDiffClick(diff.path1.line, jdd.LEFT);
                });
                left.push(diff.path1.line);
            }

            document.querySelector('pre.right div.line' + diff.path2.line + ' span.code').classList.add(diff.type);
            document.querySelector('pre.right div.line' + diff.path2.line + ' span.code').classList.add('diff');
            if (_.indexOf(right, diff.path2.line) === -1) {
                document.querySelector('pre.right div.line' + diff.path2.line + ' span.code').addEventListener('click', function () {
                    jdd.handleDiffClick(diff.path2.line, jdd.RIGHT);
                });
                right.push(diff.path2.line);
            }
        });

        jdd.diffs = jdd.diffs.sort(function (a, b) {
            return a.path1.line - b.path1.line;
        });

    },

    /**
     * Validate the input against the JSON parser
     */
    validateInput: function (json, side) {
        try {
            var result = jsl.parser.parse(json);

            if (side === jdd.LEFT) {
                document.getElementById('errorLeft').textContent = '';
                document.getElementById('errorLeft').style.display = 'none';
                document.getElementById('textarealeft').classList.remove('error');
            } else {
                document.getElementById('errorRight').textContent = '';
                document.getElementById('errorRight').style.display = 'none';
                document.getElementById('textarearight').classList.remove('error');
            }

            return true;
        } catch (parseException) {
            if (side === jdd.LEFT) {
                document.getElementById('errorLeft').textContent = parseException.message;
                document.getElementById('errorLeft').style.display = 'block';
                document.getElementById('textarealeft').classList.add('error');
            } else {
                document.getElementById('errorRight').textContent = parseException.message;
                document.getElementById('errorRight').style.display = 'block';
                document.getElementById('textarearight').classList.add('error');
            }
            return false;
        }
    },

    /**
     * Handle the file uploads
     */
    handleFiles: function (files, side) {
        var reader = new FileReader();

        reader.onload = (function (theFile) {
            return function (e) {
                if (side === jdd.LEFT) {
                    document.getElementById('textarealeft').value = e.target.result;
                } else {
                    document.getElementById('textarearight').value = e.target.result;
                }
            };
        })(files[0]);

        reader.readAsText(files[0]);
    },

    setupNewDiff: function () {
        document.querySelector('div.initContainer').style.display = 'block';
        document.querySelector('div.diffcontainer').style.display = 'none';
        document.querySelector('div.diffcontainer pre').textContent = '';
        document.querySelector('ul.toolbar').textContent = '';
    },

    /**
     * Generate the report section with the diff
     */
    generateReport: function () {
        var report = document.getElementById('report');

        report.textContent = '';

        var newDiff = document.createRange().createContextualFragment('<button>Perform a new diff</button>');
        report.appendChild(newDiff);
        report.querySelector('button').addEventListener('click', function () {
            jdd.setupNewDiff();
        });

        if (jdd.diffs.length === 0) {
            report.append('<span>The two files were semantically  identical.</span>');
            return;
        }

        var typeCount = 0;
        var eqCount = 0;
        var missingCount = 0;

        _.each(jdd.diffs, function (diff) {
            if (diff.type === jdd.EQUALITY) {
                eqCount++;
            } else if (diff.type === jdd.MISSING) {
                missingCount++;
            } else if (diff.type === jdd.TYPE) {
                typeCount++;
            }
        });

        var title = $('<div class="reportTitle"></div>');
        if (jdd.diffs.length === 1) {
            title.text('Found ' + (jdd.diffs.length) + ' difference');
        } else {
            title.text('Found ' + (jdd.diffs.length) + ' differences');
        }

        report.prepend(title);

        var filterBlock = document.createRange().createContextualFragment('<span class="filterBlock">Show:</span>');

        /*
         * The missing checkbox
         */
        if (missingCount > 0) {
            var missing = document.createRange().createContextualFragment('<label><input id="showMissing" type="checkbox" name="checkbox" value="value" checked="true"></label>');
            if (missingCount === 1) {
                missing.appendChild(document.createTextNode(missingCount + ' missing property'));
            } else {
                missing.appendChild(document.createTextNode(missingCount + ' missing properties'));
            }
            missing.querySelector('input').addEventListener('click', function () {
                if (!$(this).prop('checked')) {
                    document.querySelector('span.code.diff.missing').classList.add('missing_off').
                        document.querySelector('span.code.diff.missing').classList.remove('missing');
                } else {
                    document.querySelector('span.code.diff.missing_off').classList.add('missing').
                        document.querySelector('span.code.diff.missing_off').classList.remove('missing_off');
                }
            });
            filterBlock.append(missing);
        }

        /*
         * The types checkbox
         */
        if (typeCount > 0) {
            var types = $('<label><input id="showTypes" type="checkbox" name="checkbox" value="value" checked="true"></label>');
            if (typeCount === 1) {
                types.append(typeCount + ' incorrect type');
            } else {
                types.append(typeCount + ' incorrect types');
            }

            types.children('input').click(function () {
                if (!$(this).prop('checked')) {
                    $('span.code.diff.type').addClass('type_off').removeClass('type');
                } else {
                    $('span.code.diff.type_off').addClass('type').removeClass('type_off');
                }
            });
            filterBlock.append(types);
        }
        /*
         * The equals checkbox
         */
        if (eqCount > 0) {
            var eq = document.createRange().createContextualFragment('<label><input id="showEq" type="checkbox" name="checkbox" value="value" checked="true"></label>');
            if (eqCount === 1) {
                eq.appendChild(document.createTextNode(eqCount + ' unequal value'));
            } else {
                eq.appendChild(document.createTextNode(eqCount + ' unequal values'));
            }
            eq.querySelector('input').addEventListener('click', function () {
                if (!this.checked) {
                    document.querySelector('span.code.diff.eq').classList.add('eq_off');
                    document.querySelector('span.code.diff.eq').classList.remove('eq');
                } else {
                    document.querySelector('span.code.diff.eq_off').classList.add('eq');
                    document.querySelector('span.code.diff.eq_off').classList.remove('eq_off');
                }
            });
            filterBlock.appendChild(eq);
        }

        report.appendChild(filterBlock);


    },

    /**
     * Implement the compare button and complete the compare process
     */
    compare: function () {

        if (jdd.requestCount !== 0) {
            /*
             * This means we have a pending request and we just need to wait for that to finish.
             */
            return;
        }

        document.body.classList.add('progress');
        document.getElementById('compare').disabled = true;

        var loadUrl = function (id, errId) {
            if (document.getElementById(id).value.trim().substring(0, 4).toLowerCase() === 'http') {
                jdd.requestCount++;
                ajax('proxy.php',
                    {
                        'url': document.getElemnetById(id).value.trim()
                    }, function (responseObj) {
                        if (responseObj.error) {
                            document.getElemnetById(errId).textContent = responseObj.result;
                            document.getElemnetById(errId).style.display = 'block';
                            document.getElemnetById(id).classList.add('error');
                            document.body.classList.remove('progress');
                            document.getElemnetById('compare').disabled = false;
                        } else {
                            document.getElemnetById(id).val(responseObj.content);
                            jdd.requestCount--;
                            jdd.compare();
                        }
                    }, 'json');
                return true;
            } else {
                return false;
            }
        };

        if (loadUrl('textarealeft', 'errorLeft')) {
            return;
        }

        if (loadUrl('textarearight', 'errorRight')) {
            return;
        }

        /*
         * We'll start by running the text through JSONlint since it gives
         * much better error messages.
         */
        var leftValid = jdd.validateInput(document.getElementById('textarealeft').value, jdd.LEFT);
        var rightValid = jdd.validateInput(document.getElementById('textarearight').value, jdd.RIGHT);

        if (!leftValid || !rightValid) {
            document.body.classList.remove('progress');
            document.getElementById('compare').disabled = false;
            return;
        }

        document.querySelector('div.initContainer').style.display = 'none';
        document.querySelector('div.diffcontainer').style.display = 'block';

        jdd.diffs = [];

        var left = JSON.parse(document.getElementById('textarealeft').value);
        var right = JSON.parse(document.getElementById('textarearight').value);


        var config = jdd.createConfig();
        jdd.formatAndDecorate(config, left);
        document.getElementById('out').textContent = config.out;

        var config2 = jdd.createConfig();
        jdd.formatAndDecorate(config2, right);

        document.getElementById('out2').textContent = config2.out;
        // TODO: 
        jdd.formatPRETags();

        config.currentPath = [];
        config2.currentPath = [];

        jdd.diffVal(left, config, right, config2);
        jdd.processDiffs();
        jdd.generateReport();

        //console.log('diffs: ' + JSON.stringify(jdd.diffs));

        if (jdd.diffs.length > 0) {
            jdd.highlightDiff(0);
            jdd.currentDiff = 0;
            jdd.updateButtonStyles();
        }

        document.body.classList.remove('progress');
        document.getElementById('compare').disabled = false;

        /*
         * We want to switch the toolbar bar between fixed and absolute position when you
         * scroll so you can get the maximum number of toolbar items.
         */

        // TODO: 
        var toolbarTop = $('#toolbar').offset().top - 15;

        $(window).scroll(function () {
            if (toolbarTop < $(window).scrollTop()) {
                document.getElementById('toolbar').setAttribute('style', 'position:fixed;top:10px');
            } else {
                document.getElementById('toolbar').setAttribute('style', 'position:absolute;top:""');
            }
        });

    },

    /**
     * Load in the sample data
     */
    loadSampleData: function () {
        document.getElementById('textarealeft').value = '{"Aidan Gillen": {"array": ["Game of Thron\\"es","The Wire"],"string": "some string","int": 2,"aboolean": true, "boolean": true,"object": {"foo": "bar","object1": {"new prop1": "new prop value"},"object2": {"new prop1": "new prop value"},"object3": {"new prop1": "new prop value"},"object4": {"new prop1": "new prop value"}}},"Amy Ryan": {"one": "In Treatment","two": "The Wire"},"Annie Fitzgerald": ["Big Love","True Blood"],"Anwan Glover": ["Treme","The Wire"],"Alexander Skarsgard": ["Generation Kill","True Blood"], "Clarke Peters": null}';
        /*document.getElementById('textarealeft').value='[{  "OBJ_ID": "CN=Kate Smith,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com",  "userAccountControl": "512",  "objectGUID": "b3067a77-875b-4208-9ee3-39128adeb654",  "lastLogon": "0",  "sAMAccountName": "ksmith",  "userPrincipalName": "ksmith@cloudaddc.qalab.cam.novell.com",  "distinguishedName": "CN=Kate Smith,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com"},{  "OBJ_ID": "CN=Timothy Swan,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com",  "userAccountControl": "512",  "objectGUID": "c3f7dae9-9b4f-4d55-a1ec-bf9ef45061c3",  "lastLogon": "130766915788304915",  "sAMAccountName": "tswan",  "userPrincipalName": "tswan@cloudaddc.qalab.cam.novell.com",  "distinguishedName": "CN=Timothy Swan,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com"}]');
        document.getElementById('textarearight').value='{"foo":[{  "OBJ_ID": "CN=Timothy Swan,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com",  "userAccountControl": "512",  "objectGUID": "c3f7dae9-9b4f-4d55-a1ec-bf9ef45061c3",  "lastLogon": "130766915788304915",  "sAMAccountName": "tswan",  "userPrincipalName": "tswan@cloudaddc.qalab.cam.novell.com",  "distinguishedName": "CN=Timothy Swan,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com"}]}');*/
        document.getElementById('textarearight').value = '{"Aidan Gillen": {"array": ["Game of Thrones","The Wire"],"string": "some string","int": "2","otherint": 4, "aboolean": "true", "boolean": false,"object": {"foo": "bar"}},"Amy Ryan": ["In Treatment","The Wire"],"Annie Fitzgerald": ["True Blood","Big Love","The Sopranos","Oz"],"Anwan Glover": ["Treme","The Wire"],"Alexander Skarsg?rd": ["Generation Kill","True Blood"],"Alice Farmer": ["The Corner","Oz","The Wire"]}';
    },

    getParameterByName: function (name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
            results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }
};


document.addEventListener('DOMContentLoaded', function () {

    document.getElementById('compare').addEventListener('click', function () {
        jdd.compare();
    });

    if (jdd.getParameterByName('left')) {
        document.getElementById('textarealeft').value = jdd.getParameterByName('left');
    }

    if (jdd.getParameterByName('right')) {
        document.getElementById('textarearight').value = jdd.getParameterByName('right');
    }

    if (jdd.getParameterByName('left') && jdd.getParameterByName('right')) {
        jdd.compare();
    }


    document.getElementById('sample').addEventListener('click', function (e) {
        e.preventDefault();
        jdd.loadSampleData();
    });

    document.addEventListener('keydown', function (event) {
        if (event.keyCode === 78 || event.keyCode === 39) {
            /*
             * The N key or right arrow key
             */
            jdd.highlightNextDiff();
        } else if (event.keyCode === 80 || event.keyCode === 37) {
            /*
             * The P key or left arrow key
             */
            jdd.highlightPrevDiff();
        }
    });
}, false);

// UTILITIES, HELPERS
/**
 * IE 5.5+, Firefox, Opera, Chrome, Safari XHR object
 * 
 * @param string url
 * @param object callback
 * @param mixed data
 * @param null x
 */
function ajax(url, data, callback, x) {
    try {
        x = new (this.XMLHttpRequest || ActiveXObject)('MSXML2.XMLHTTP.3.0');
        x.open(data ? 'POST' : 'GET', url, 1);
        x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        x.setRequestHeader("Content-Type", "application/json");
        x.onreadystatechange = function () {
            x.readyState > 3 && callback && callback(JSON.parse(x.responseText), x);
        };
        data ? x.send(JSON.stringify(data)) : x.send();
    } catch (e) {
        window.console && console.log(e);
    }
};