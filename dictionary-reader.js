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
        
        filename = this.dictionariesDir + "/" + filename;
        console.log("Reading " + filename + "...")
    
        var startTime = new Date();
        var lineReader = new readlines(filename);
    
        let count = 0;
        let line;
        while (line = lineReader.next()) {
            line = line.toString().trim();
            if (line != "" && line[0] != '#')
            {
                let fields = line.split('\t');
                if (fields.length >= 2) {
                    let wordType = (fields.length >= 3 ? fields[2] : "");
                    if (dict.addEntry(fields[0], fields[1], wordType))
                        count++;
                }
            } 
        }
    
        var duration = new Date() - startTime;
        var durStr = (duration < 1000 ? duration.toString() + " ms"
                                      : (duration/1000).toString() + " seconds");
    
        console.log("Loaded " + count + " dictionary entries in " + durStr);
        return dict;
    }
    
}
