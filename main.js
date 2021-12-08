'use strict';

const fs = require('fs');
const readlines = require('n-readlines');
var Dictionary = require('./dictionary.js');
var Language = require('./language.js');
var LanguageReader = require('./language-reader.js');

function isPunctuation(ch) {
    // basic latin
    if ((ch >= '\u0021' && ch <= '\u002F') || (ch >= '\u003A' && ch <= '\u0040')
            || (ch >= '\u005B' && ch <= '\u0060') || (ch >= '\u007B' && ch <= '\u007E'))
        return true;

    // latin extended A
    if ((ch >= '\u00A0' && ch <= '\u00BF') || ch == '\u00D7' || ch == '\u00F7')
        return true;

    // general punctuation
    if (ch >= '\u2000' && ch <= '\u206F')
        return true;
    
    // TODO: other punctuation
    return false;
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
    if (sentences == null)
        return [];
    else
        return sentences;
}

function splitWords(text) {
    var words = text.match(/[^ \.\?!;]+/g);
    if (words == null)
        return [];
    else
        return words;
}

function readDictionary(sourceLang, targetLang, filename) {
    var dict = new Dictionary(sourceLang, targetLang);
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
                if (dict.addEntry(fields[0], fields[1]))
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

function sortByFrequency(meanings)
{
    return meanings.sort((a, b) => {
        if (a.frequency < b.frequency)
            return -1;
        else if (b.frequency < a.frequency)
            return 1;
        // if frequency is equal then put entries without annotations in the source
        // language first - they are likely to be more common
        else if (!a.source.includes("[") && b.source.includes("["))
            return -1;
        else if (a.source.includes("[") && !b.source.includes("["))
            return 1;
        else
            return 0;
    });
}

function process(requestData) {
    var sourceLang = languages[requestData["source_lang"]];
    var freqThreshold = parseInt(requestData["freqThreshold"]);
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

            // ignore anything which is all numbers and/or punctuation
            if (word.match(/^[0-9\.,\?!\-]*$/))
                continue;

            if (lookedUp[word])
                continue;

            let meanings = lookup(dictionary, sourceLang, word);
            if (meanings.length > 0 && meanings[0].frequency <= freqThreshold)
                    continue;

            // may be uppercase because it starts a sentence
            // try to lookup up word in lowercase
            let lower = word.toLowerCase();
            let prevLookedUpLower = false;
            if (lower != word) {
                prevLookedUpLower = lookedUp[lower];
                if (!prevLookedUpLower) {
                    let lowerMeanings = lookup(dictionary, sourceLang, lower);
                    if (lowerMeanings.length > 0 && lowerMeanings[0].frequency <= freqThreshold)
                        continue;
                    meanings = meanings.concat(lowerMeanings);
                }
            }

            let canonicals = sourceLang.getCanonicals(word);
            for (let c = 0; c < canonicals.length; c++) {
                let canonical = canonicals[c];
                let extras = lookup(dictionary, sourceLang, canonical);
                if (extras.length > 0) {
                    //console.log("Adding results for " + canonical + " to results for " + word);
                    meanings = meanings.concat(extras);
                }
            }

            if (meanings.length == 0) {
                if (prevLookedUpLower)
                    continue;
                let entry = {key: word, source: word, target:"???"};
                entry.frequency = sourceLang.getFrequencyRank(word);
                meanings.push(entry);
            }


            let ignore = false;
            for (var m of meanings) {
                if (m.frequency <= freqThreshold) {
                    ignore = true;
                    break;
                }
            }
            if (ignore)
                continue;
            results = results.concat(sortByFrequency(meanings));
        }
    }

    // convert frequency to string
    // put X+ if it's not in the frequency list
    var numFreqs = sourceLang.getFrequencyListSize();
    for (var res of results) {
        if (res.frequency > numFreqs) {
            if (res.target == "???")
                res.freq = "";
            else
                res.freq = numFreqs.toString() + "+";
        }
        else
            res.freq = res.frequency.toString();
    }

    return results;
}

module.exports = {init, process};