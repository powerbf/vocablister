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
        this.readSeparablePrefixes(lang, dir);
        this.readFrequencyList(lang, dir);
        return lang;
    }

    readFrequencyList(lang, dir) {
        var filename = dir + "/" + "frequency.txt";

        var count = 0;
        var rank = 0;
        var lastOccurrences = Number.MAX_VALUE;
        var lineReader = new readlines(filename);
        var line;

        var startTime = new Date();
        while (line = lineReader.next()) {
            line = line.toString().trim();
            if (line == "" || line[0] == '#')
                continue;

            let tokens = line.split(" ");
            let word = tokens.slice(0, -1).join(" ");
            let occurences = parseInt(tokens.slice(-1)[0]);

            if (word.length > 0 && occurences > 0) {
                count++;
                if (occurences < 3)
                    rank = Language.RARE;
                else if (occurences < lastOccurrences) {
                    rank = count;
                    if (rank > 10000) {
                        // beyond a certain point, occurrences are low and rankings are approximate
                        //console.log("Rank: " + rank)
                        if (rank >= 100000)
                            rank = 100000;
                        else if (rank >= 30000)
                            rank = Math.floor(rank/10000) * 10000;
                        else
                            rank = Math.floor(rank/1000) * 1000;
                    }
                }
                lastOccurrences = occurences;
                lang.addToFrequencyList(word, rank);
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

        console.log("Loaded " + count + " variant patterns");
    }

    readSeparablePrefixes(lang, dir) {
        var filename = dir + "/" + "separable-prefixes.txt";
        if (!fs.existsSync(filename))
            return;

        var line;
        var count = 0;
        var lineReader = new readlines(filename);

        while (line = lineReader.next()) {
            line = line.toString().trim();
            if (line != "" && line[0] != '#')
            {
                lang.addSeparablePrefix(line);
                count++;
            }
        }

        console.log("Loaded " + count + " separable prefixes");

    }
}