'use strict';

const fs = require('fs');
const readlines = require('n-readlines');
var Dictionary = require('./dictionary.js');
var Language = require('./language.js');
var LanguageReader = require('./language-reader.js');

const SOFT_HYPHEN = '\u00AD';

// globals - yuck
var languages = {};
var dictionaries = {};

var dictionary;
var sourceLang;
var freqThreshold;
var searched = {}

function isWhitespace(ch) {
    if (" \t\r\n".includes(ch))
        return true;
    // non-breaking spaces
    if ("\u00A0\u202F\u2007\u2060".includes(ch))
        return true;
    return false;
}

function isControlChar(ch) {
    if (ch <= '\u001F' || ( ch >= '\u007F' && ch <= '\u009F'))
        return !isWhitespace(ch);
    return false;
}

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
        if (isWhitespace(ch)) {
            result += ' ';
        }
        else if (isControlChar(ch)) {
            // ignore
        }
        else if (isPunctuation(ch)) {
            if (ch == SOFT_HYPHEN)
                result += ''; // ignore
            else if (isSentenceTerminator(ch) || isWordPunctuation(ch))
                result += ch; // keep
            else
                result += ' '; // replace with space
        }
        else {
            result += ch;
        }
    }

    // replace multiple spaces with a single space, and trim
    result = result.trim().replace(/ +/g, " ");

    return result;
}

function isKnownWord(word) {
    if (sourceLang.getFrequencyRank(word) <= sourceLang.getFrequencyListSize())
        return true;
    else if (dictionary.lookup(word).length > 0)
        return true;
    return false;
}

function findFirstOf(str, pos, chars)
{
    while (pos < str.length) {
        if (chars.includes(str[pos]))
            return pos;
        pos++;
    }
    return pos;
}

function getNextSentenceWords(text, pos, words) {

    let start = pos;
    let end = -1;
    let sentenceEnded = false;

    do {
        end = findFirstOf(text, start, " !?;");
        end++;
        let word = text.slice(start, end).trim();
        let done = false;
        do {
            let last = word.slice(-1);
            if (last == " ") {
                word = word.slice(0, -1);
            }
            else if (last == "!" || last == "?" || last == ";") {
                sentenceEnded = true;
                word = word.slice(0, -1);
            }
            else if (last == ".") {
                // could be end of sentence, but could also be an abbreviation
                if (word.match(/^[0-9\.\-\?!;]+$/)) {
                    // all numbers and/or punctuation
                    done = true;
                    sentenceEnded = (word.match(/[0-9]+/) == null);
                }
                else if (isKnownWord(word)) {
                    done = true;
                }
                else {
                    sentenceEnded = true;
                    word = word.slice(0, -1);
                }
            }
            else {
                done = true;
            }
        } while (!done);
        if (word.length > 0) {
            words.push(word);
        }
        start = end;
    } while (!sentenceEnded && start < text.length);

    return end;
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


function init() {
    languages = new LanguageReader().readLanguages();
    var de_en = readDictionary("de", "en", "./dat/dict/de-en.txt");
    dictionaries["de-en"] = de_en;
    //de_en.addEntry("Hund", "dog");
}

// a simple lookup of a word
function lookup(dict, sourceLang, word) {
    var results = dict.lookup(word);
    if (results.length > 0) {
        var freq = sourceLang.getFrequencyRank(word);
        var inFrequencyList = freq <= sourceLang.getFrequencyListSize();
        for (let i = 0; i < results.length; i++) {
            results[i].frequency = freq;
            results[i].inFrequencyList = inFrequencyList;
        }
    }
    return results;
}

function lookupWordAndCanonicals(dict, sourceLang, word) {
    searched[word] = true;

    // first look up the word itself
    var meanings = lookup(dict, sourceLang, word);

    // now lookup and words that it might be a variant of
    let canonicals = sourceLang.getCanonicals(word);
    for (let c = 0; c < canonicals.length; c++) {
        let canonical = canonicals[c];
        let extras = lookup(dict, sourceLang, canonical);
        if (extras.length > 0) {
            meanings = meanings.concat(extras);
        }
    }

    return sortByFrequencyandQuality(meanings);
}

function findMeanings(word) {
    let meanings = lookupWordAndCanonicals(dictionary, sourceLang, word);
    if (anyBelowThreshold(freqThreshold, meanings)) {
        // stop here because we're going to throw this away anyway
        return meanings;
    }

    // may be uppercase because it starts a sentence
    // try to lookup word in lowercase
    let lower = word.toLowerCase();
    if (lower != word) {
        let lowerMeanings = lookupWordAndCanonicals(dictionary, sourceLang, lower);
        meanings = meanings.concat(lowerMeanings);
    }

    if (meanings.length == 0) {
        // try capitalising first letter
        let upper = word.slice(0,1).toUpperCase() + word.slice(1);
        if (upper != word) {
            meanings = lookupWordAndCanonicals(dictionary, sourceLang, upper); 
        }
    }

    return meanings;
    }

// returns a 2D array
function findMeaningsOfWordParts(word) {
    let results = [];
    let rest = word;
    let i = 1;
    while (i < rest.length - 1) {
        let searchTerm = rest.slice(i);
        let meanings = findMeanings(searchTerm);
        if (meanings.length == 0) {
            i++;
        }
        else {
            rest = rest.slice(0, i);
            i = 0;
            results.unshift(meanings);
        }
    }
    return results;
}

function sortByFrequencyandQuality(meanings)
{
    if (meanings.length < 2)
        return meanings;

    for (let entry of meanings) {
        // count definitions
        entry.defCount = (entry.target.match(/,/g) || []).length + 1;

        // does the meaning relate to a specific context?
        entry.specific = (entry.source.includes("(") ||
                          entry.source.match(/[^\s].*\[/) != null ||
                          (entry.defCount == 1 && entry.target.match(/[^\s].*\[/) != null));

        entry.vulgar = (entry.source.includes("vulg."));
    }

    return meanings.sort((a, b) => {
        if (a.frequency != b.frequency)
            return (a.frequency < b.frequency ? -1 : 1);
        else if (a.specific != b.specific)
            return (b.specific ? -1 : 1);
        else if (a.defCount != b.defCount)
            return (a.defCount > b.defCount ? -1 : 1);
        else
            return 0;
    });
}

function isDifferentWord(a, b) {
    if (a.frequency != b.frequency)
        return true;
    else if (a.isInFrequencyList)
        return false;
    else
        return (a.key != b.key);
}

function filterResults(entries)
{
    if (entries.length < 2)
        return entries;
    
    // first one should be the best match, so always take it
    var filtered = [entries[0]];
    var lastKept = entries[0];

    for (let i = 1; i < entries.length; i++) {
        let entry = entries[i];
        if (isDifferentWord(entry, lastKept)) {
            filtered.push(entry);
            lastKept = entry;
        }
        else {
            // another definition for the same word, but could be important enough to keep
            if (!entry.specific || (entry.defCount >= 5 && !entry.vulgar)) {
                filtered.push(entry);
                lastKept = entry;
            }
        }
    }
    return filtered;
}

function removeDuplicates(entries)
{
    let included = {};
    let results = [];
    for (let entry of entries) {
        let previous = included[entry.source];
        if (previous == null) {
            results.push(entry);
            included[entry.source] = [entry];
        }
        else {
            let keep = true;
            for (let other of previous) {
                if (other.target == entry.target) {
                    keep = false;
                    break;
                }
            }
            if (keep) {
                results.push(entry);
                previous.push(entry);
            }
        }
    }
    return results;
}

function anyBelowThreshold(freqThreshold, meanings) {
    for (let m of meanings) {
        if (m.frequency <= freqThreshold)
            return true;
    }
    return false;
}

function process(requestData) {
    freqThreshold = requestData["freqThreshold"];
    var showAll = requestData["show_all"];
    var text = cleanText(requestData["text"]);

    var sourceLangCode = requestData["source_lang"];
    sourceLang = languages[sourceLangCode];
    if (sourceLang == null) {
        throw new Error("Language '" + sourceLangCode + "' unknown");
    }

    dictionary = dictionaries["de-en"];

    var results = [];
    searched = {};

    var pos = 0;
    while (pos < text.length) {
        let words = [];
        pos = getNextSentenceWords(text, pos, words);

        //let sentence = words.join(" ");
        //console.log(sentence);

        for (let word of words) {

            // ignore anything that is all numbers and/or punctuation
            if (word.match(/^[0-9\.\-\?!;]+$/))
                continue;

            if (sourceLang.getFrequencyRank(word) <= freqThreshold)
                continue;

            if (searched[word])
                continue;

            let meanings = findMeanings(word);

            if (anyBelowThreshold(freqThreshold, meanings))
                continue;

            let gotResults = (meanings.length != 0);

            if (meanings.length == 0) {
                // try breaking word up
                let partMeanings = findMeaningsOfWordParts(word);
                gotResults = (partMeanings.length != 0);
                
                for (let m of partMeanings) {
                    if (!anyBelowThreshold(freqThreshold, m))
                        meanings = meanings.concat(m);
                }
            }

            if (showAll && !gotResults) {
                let entry = {key: word, source: word, target:"???"};
                entry.frequency = sourceLang.getFrequencyRank(word);
                meanings.push(entry);
            }
        
            results = results.concat(meanings);
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

    if (!showAll)
        results = filterResults(results);

    results = removeDuplicates(results);
    return results;
}

module.exports = {init, process};