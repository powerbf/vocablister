'use strict';

const fs = require('fs');
const readlines = require('n-readlines');
var Language = require('./language.js');

module.exports = class LanguageReader {
    
    constructor() {
        this.languagesDir = "./dat/lang";
    }

    readLanguages() {
        var langs = {};
        langs["de"] = this.readLanguage("de");
        return langs;
    }

    readLanguage(code) {
        console.log("Loading language: " + code + "...")
        var lang = new Language(code);
        var dir = this.languagesDir + "/" + code;
        this.readVariantPatterns(lang, dir);
        this.readFrequencyList(lang, dir);
        return lang;
    }

    readFrequencyList(lang, dir) {
        var filename = dir + "/" + "frequency.txt";

        var line;
        var count = 0;
        var lineReader = new readlines(filename);

        var startTime = new Date();
        while (line = lineReader.next()) {
            line = line.toString().trim();
            if (line != "" && line[0] != '#')
            {
                let word = line.replace(/\s*[0-9]*$/, "");
                if (word.length > 0) {
                    lang.addToFrequencyList(word);
                    count++;
                }
            } 
        }
        var duration = new Date() - startTime;
        var durStr = (duration < 1000 ? duration.toString() + " ms"
                                      : (duration/1000).toString() + " seconds");

        console.log("Loaded " + count + " frequent words in " + durStr);
    }

    readVariantPatterns(lang, dir) {
        var filename = dir + "/" + "variant-patterns.txt";

        var line;
        var count = 0;
        var lineReader = new readlines(filename);

        while (line = lineReader.next()) {
            line = line.toString().trim();
            if (line != "" && line[0] != '#')
            {
                let fields = line.split(',');
                if (fields.length >= 2) {
                    let lastResort = (fields.length >=3 && fields[2].toLowerCase() == "true");
                    lang.addVariantPattern(fields[0], fields[1], lastResort);
                    count++;
                }
            } 
        }

        console.log("Read " + count + " variant patterns for " + lang.code);
    }

}