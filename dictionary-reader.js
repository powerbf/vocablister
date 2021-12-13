'use strict';

const fs = require('fs');
const readlines = require('n-readlines');
var Dictionary = require('./dictionary.js');

module.exports = class DictionaryReader {
    
    constructor() {
        this.dictionariesDir = "./dat/dict";
    }

    readDictionaries() {
        var dicts = {};
        dicts["de-en"] = this.readDictionary("de", "en", "de-en.txt");
        return dicts;
    }

    readDictionary(sourceLang, targetLang, filename) {
        var dict = new Dictionary(sourceLang, targetLang);

        let dingStyle = (filename == "de-en.txt");

        filename = this.dictionariesDir + "/" + filename;
        console.log("Reading " + filename + "...")
    
        var startTime = new Date();
        var lineReader = new readlines(filename);
    
        let count = 0;
        let line;
        while (line = lineReader.next()) {
            line = line.toString().trim();
            if (line != "" && line[0] != '#') {
                if (dingStyle)
                    this.parseDingStyle(dict, line);
                else
                    this.parseDictCCStyle(dict, line);
                count++;
            } 
        }
    
        var duration = new Date() - startTime;
        var durStr = (duration < 1000 ? duration.toString() + " ms"
                                      : (duration/1000).toString() + " seconds");
    
        console.log("Loaded " + count + " dictionary entries in " + durStr);
        return dict;
    }

    parseDictCCStyle(dict, line) {
        let fields = line.split('\t');
        if (fields.length >= 2) {
            let wordType = (fields.length >= 3 ? fields[2] : "");
            dict.addEntry(fields[0], fields[1], wordType);
        }
    }

    parseDingStyle(dict, line) {
        let tokens = line.split("::");
        if (tokens.length != 2)
            return false;

        // determine word type
        let wordType = "";
        let match = tokens[0].match(/\{([^\}]+)\}/);
        if (match != null && match.length >= 2) {
            wordType = match[1];
            if (match[1].startsWith("v"))
                wordType = "verb";
            else if (match[1].includes("adv"))
                wordType = "adv";
            else if (match[1].includes("adj"))
                wordType = "adj";
            else if (match[1].includes("pron"))
                wordType = "pron";
            else {
                let gender = match[1].split(",")[0];
                if (gender == "f" || gender == "m" || gender == "n" || gender == "pl")
                    wordType = "noun";
            }
        }

        let sources = tokens[0].split("|");
        let targets = tokens[1].split("|");

        let success = false;

        let srcs = sources[0].split(";")
        if (wordType != "noun")
            this.propagateAnnotations(srcs);
        let tgts = targets[0].trim();
        for (let src of srcs) {
            src = src.trim();
            success |= dict.addEntry(src, tgts, wordType);
        }


        if (wordType == "noun" && sources.length > 1 && targets.length > 1) {
            // do the plurals as well
            srcs = sources[1].split(";")
            tgts = targets[1].trim();
            for (let src of srcs) {
                src = src.trim();
                success |= dict.addEntry(src, tgts, wordType);
            }
        }

        return success;
    }
    
    propagateAnnotations(srcs) {
        let prev = "";
        let len = srcs.length;
        let i;
        for (i = len - 1; i >= 0; i--) {
            let annotation = srcs[i].match(/\{[^\}]+\}/);
            if (annotation != null && annotation.length >= 1) {
                prev = " " + annotation[0];
            }
            else if (prev != "") {
                srcs[i] += prev;
            }
        }
    }
}
