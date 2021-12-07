'use strict';

const fs = require('fs');
const readline = require('readline');
var Dictionary = require('./dictionary.js');
var Language = require('./language.js');
var LanguageReader = require('./language-reader.js');

function isPunctuation(ch) {
    return ((ch >= '\u0021' && ch <= '\u002F') || (ch >= '\u003A' && ch <= '\u0040')
           || (ch >= '\u005B' && ch <= '\u0060') || (ch >= '\u007B' && ch <= '\u007E'));
    // TODO: other punctuation
}

function isWordPunctuation(ch) {
    return (ch == "'" || ch == '-' || ch == '.');
}

function isSentenceTerminator(ch) {
    return (ch == '.' || ch == '!' || ch == '?' || ch == ';')
}

function cleanText(text)
{
    var result = "";

    for (let i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch <= '\u001F' || ( ch >= '\u007F' && ch <= '\u009F')) {
            // replace control chars with spaces
            result += ' ';
        }
        else if (isPunctuation(ch)) {
            // only keep relevant punctuation
            result += (isSentenceTerminator(ch) || isWordPunctuation(ch) ? ch : ' ');
        }
        else if(ch == '\u00A0' || ch == '\u202F' || ch == '\u2007' || ch == '\u2060') {
            // replace non-breaking spaces with normal space
            result += ' ';
        }
        else {
            result += ch;
        }
    }

    // replace multiple spaces with a single space, and trim
    result = result.trim().replace(/ +/g, " ");

    return result;
}

// return array of sentence
function splitSentences(text) {
    var sentences = text.match(/[^\s].*?([\.\?!;]|$)/g);
    if (typeof sentences === 'undefined')
        return [];
    else
        return sentences;
}

function splitWords(text) {
    var words = text.match(/[^ \.\?!;]+/g);
    if (typeof words === 'undefined')
        return [];
    else
        return words;
}

function readDictionary(sourceLang, targetLang, filename) {
    var dict = new Dictionary(sourceLang, targetLang);
    console.log("Reading " + filename + "...")
    var lineReader = readline.createInterface({
        input: fs.createReadStream(filename)
    });
  
    lineReader.on('line', function (line) {
        line = line.trim();
        if (line != "" && line[0] != '#')
        {
            let fields = line.split('\t');
            if (fields.length >= 2)
                dict.addEntry(fields[0], fields[1]);
        } 
    });
    return dict;
}

var languages = {};
var dictionaries = {};
function init() {
    languages = new LanguageReader().readLanguages();
    var de_en = readDictionary("de", "en", "./dat/dict/de-en.txt");
    dictionaries["de-en"] = de_en;
    //de_en.addEntry("Hund", "dog");
}

var lookedUp = {}
function lookup(dict, sourceLang, word) {
    if (lookedUp[word])
        return[];
    lookedUp[word] = true;
    var results = dict.lookup(word);
    if (results.length > 0) {
        var freq = sourceLang.getFrequencyRank(word);
        for (let i = 0; i < results.length; i++) {
            results[i].frequency = freq;
        }
    }
    return results;
}

function _sortByFrequency(meanings) {
    var temp = {};
    for (let i = 0; i < meanings.length; i++) {
        let freq = meanings[i].frequency;
        if (!(freq in temp))
            temp[freq] = [];
        temp[freq].push(meanings[i]);
    }

    var result = [];
    for (var key in Object.keys(temp).sort()) {
        result.concat(temp[key]);
    }
    return result;
}

function sortByFrequency(meanings)
{
    return meanings.sort((a, b) => {
        if (a.frequency < b.frequency)
            return -1;
        else if (b.frequency < a.frequency)
            return 1;
        else
            return 0;
    });
}

function process(requestData) {
    var sourceLang = languages[requestData["source_lang"]];
    var minFrequency = 100;
    var text = cleanText(requestData["text"]);

    var dictionary = dictionaries["de-en"];

    var results = [];
    lookedUp = {};

    var sentences = splitSentences(text);
    for (let i = 0; i < sentences.length; i++) {
        console.log(i.toString() + ": " + sentences[i]);
        let words = splitWords(sentences[i]);
        for (let j = 0; j < words.length; j++) {
            let word = words[j];
            if (lookedUp[word])
                continue;

            let meanings = lookup(dictionary, sourceLang, word);
            if (meanings.length > 0 && meanings[0].frequency < minFrequency)
                    continue;

            if (meanings.length == 0 && i == 0) {
                // may be uppercase because it starts a sentence
                // try to lookup up word in lowercase
                meanings = lookup(dictionary, sourceLang, word.toLowerCase());
                if (meanings.length > 0 && meanings[0].frequency < minFrequency)
                    continue;
            }


            let canonicals = sourceLang.getCanonicals(word);
            for (let c = 0; c < canonicals.length; c++) {
                let canonical = canonicals[c];
                let extras = lookup(dictionary, sourceLang, canonical);
                if (extras.length > 0) {
                    console.log("Adding results for " + canonical + " to results for " + word);
                    meanings = meanings.concat(extras);
                }
            }

            if (meanings.length == 0) {
                let entry = {source:word, target:"???"};
                entry.frequency = Number.MAX_VALUE;
                results.push(entry);
            }
            else {
                results = results.concat(sortByFrequency(meanings));
            }
        }
    }

    return results;
}

module.exports = {init, process};