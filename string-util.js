'use strict';


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

function isNumber(ch) {
    return (ch >= '0' && ch <= '9');
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

function isAlpha(ch) {
    // deal with most likely cases first
    if (ch >= 'a' && ch <= 'z')
        return true;
    else if (ch >= 'A' && ch <= 'Z')
        return true;
    else if (ch <= '\u00BF') {
        // everything else below C0 is non-alpha
        // (Basic Latin block + first half of Latin-1 Supplement)
        return false;
    }
    else if (ch <= '\u024F') {
        // Rest of Latin-1 supplement + Latin extended A and B
        // Everything in the range 00C0 to 024F is an alpha, except for 2 mathematical symbols
        return  (ch != '\u00D7' && ch != '\u00F7');
    }
    else if (ch <= '\u02AF') {
        // IPA symbols - For our purposes, they are not alphas 
        // (won't find words containing these symbols in the dictionary)
        return false;
    }
    else {
        return (!isWhitespace(ch) && !isPunctuation(ch));
    }
}

function containsAlphas(word) {
    for (let ch of word) {
        if (isAlpha(ch))
            return true;
    }
    return false;
}

// make first letter of work uppercase
function capitalise(word) {
    return word.slice(0,1).toUpperCase() + word.slice(1).toLowerCase();
}

function isCapitalised(word) {
    let first = word.slice(0,1);
    return (first.toLowerCase() != first);
}

function isWordPunctuation(ch) {
    return (ch == "'" || ch == '-' || ch == '.');
}

function isSentenceTerminator(ch) {
    return (ch == '.' || ch == '!' || ch == '?' || ch == ';')
}

module.exports = {
    isWhitespace, isControlChar, isNumber, isPunctuation, isAlpha, containsAlphas,
    capitalise, isCapitalised, isWordPunctuation, isSentenceTerminator
};