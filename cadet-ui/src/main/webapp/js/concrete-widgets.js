var ConcreteWidgets = (function() {
    var ConcreteWidgets = {};

    /**
     * Returns a jQuery object containing the DOM structure:
     *     <div class="communication communication_[COMMUNICATION_UUID]">
     *         <div class="section section_[SECTION_UUID]">
     *             [...]
     *         <div class="section section_[SECTION_UUID]">
     *             [...]
     * createCommunicationDiv() calls createSectionDiv() to create the
     * DOM structure for the Sections.
     *
     * @param {Communication} communication
     * @param {Object} options
     * @returns {jQuery Object}
     */
    ConcreteWidgets.createCommunicationDiv = function(communication, options) {
        if (!communication) {
            throw 'ERROR: CreateWidgets.createCommunicationDiv() must be passed a communication';
        }

        var communicationDiv = $('<div>')
            .addClass('communication communication_' + communication.uuid.uuidString);

        if (communication.sectionList && communication.sectionList.length) {
            for (var i = 0; i < communication.sectionList.length; i++) {
                communicationDiv.append(
                    ConcreteWidgets.createSectionDiv(communication.sectionList[i], options));
            }
        }
        else {
            console.log('WARNING: CreateWidgets.createCommunicationsDiv() was passed a Communication ' +
                        'without any Sections');
        }

        return communicationDiv;
    };

    /**
     * Returns a jQuery object containing the DOM structure:
     *     <div class="section section_[SECTION_UUID]">
     *         <div class="sentence sentence_[SENTENCE_UUID]">
     *             [...]
     *         <span class="sentence_padding"> </span>
     *         <div class="sentence sentence_[SENTENCE_UUID]">
     *             [...]
     * createSectionDiv() calls createSentenceDiv() to create the
     * DOM structure for the Sentence.
     *
     * @param {Section} section
     * @param {Object} options
     * @returns {jQuery Object}
     */
    ConcreteWidgets.createSectionDiv = function(section, options) {
        if (!section) {
            throw 'CreateWidgets.createSectionDiv() must be passed a section';
        }

        var opts = $.extend({}, ConcreteWidgets.createSectionDiv.defaultOptions, options);

        var textSpansUsed = false;
        if (section.sentenceList.length > 0) {
            textSpansUsed = concreteObjectUsesTextSpans(section.sentenceList[0]);
        }

        var sectionDiv = $('<div>')
            .addClass('section section_' + section.uuid.uuidString);

        for (var i = 0; i < section.sentenceList.length; i++) {
            sectionDiv.append(
                ConcreteWidgets.createSentenceDiv(section.sentenceList[i], options));

            if (i+1 < section.sentenceList.length) {
                if (textSpansUsed && !opts.whitespaceTokenization) {
                    // Add whitespace IFF there is a character-offset gap between sentences
                    if ((section.sentenceList[i+1].textSpan.start - section.sentenceList[i].textSpan.ending) > 0) {
                        sectionDiv.append(
                            $('<span>')
                                .addClass('sentence_padding')
                                .text(' '));
                    }
                }
            }
        }

        return sectionDiv;
    };

    ConcreteWidgets.createSectionDiv.defaultOptions = {
        'whitespaceTokenization': false,
    };

    /**
     * Returns a jQuery object containing the DOM structure:
     *     <div class="sentence sentence_[SENTENCE_UUID]">
     *         <div class="tokenization tokenization_[TOKENIZATION_UUID]">
     *             [...]
     * createSentenceDiv() calls createTokenizationDiv() to create the
     * DOM structure for the Sentence's Tokenization.
     *
     * @param {Sentence} sentence
     * @param {Object} options
     * @returns {jQuery Object}
     */
    ConcreteWidgets.createSentenceDiv = function(sentence, options) {
        if (!sentence) {
            throw 'CreateWidgets.createSentenceDiv() must be passed a sentence';
        }

        var sentenceDiv = $('<div>')
            .addClass('sentence sentence_' + sentence.uuid.uuidString)
            .append(ConcreteWidgets.createTokenizationDiv(sentence.tokenization, options));
        return sentenceDiv;
    };

    /**
     * Returns a jQuery object containing the DOM structure:
     *     <div class="tokenization tokenization_[TOKENIZATION_UUID]">
     *         <span class="token tokenization_[TOKENIZATION_UUID]_[TOKEN_INDEX_0]">
     *         <span class="token_padding">
     *         <span class="token tokenization_[TOKENIZATION_UUID]_[TOKEN_INDEX_1]">
     *         <span class="token_padding">
     *
     * @param {Tokenization} tokenization
     * @param {Object} options
     * @returns {jQuery Object}
     */
    ConcreteWidgets.createTokenizationDiv = function(tokenization, options) {
        if (!tokenization) {
            throw 'CreateWidgets.createTokenizationDiv() must be passed a tokenization';
        }

        var opts = $.extend({}, ConcreteWidgets.createTokenizationDiv.defaultOptions, options);
        var textSpansUsed = tokenizationUsesTextSpans(tokenization);
        var tokenList = tokenization.tokenList.tokenList;

        var tokenizationDiv = $('<div>')
            .addClass('tokenization tokenization_' + tokenization.uuid.uuidString);

        for (var i = 0; i < tokenList.length; i++) {
            var tokenText;
            if (opts.convertTreebankBrackets) {
                tokenText = convertTreebankBrackets(tokenList[i].text);
            }
            else {
                tokenText = tokenList[i].text;
            }

            var tokenSpan = $('<span>')
                .addClass('token tokenization_' + tokenization.uuid.uuidString + '_' + i)
                .text(tokenText);
            tokenizationDiv.append(tokenSpan);

            if (i+1 < tokenList.length) {
                var tokenPaddingSpan = $('<span>')
                    .addClass('token_padding');

                if (textSpansUsed && !opts.whitespaceTokenization) {
                    // Add whitespace IFF there is a character-offset gap between tokens
                    if ((tokenList[i+1].textSpan.start - tokenList[i].textSpan.ending) > 0) {
                        tokenPaddingSpan.text(' ');
                    }
                }
                else {
                    // Without TextSpans, we can't determine character offsets between
                    // tokens, so we default to using whitespace tokenization
                    tokenPaddingSpan.text(' ');
                }
                tokenizationDiv.append(tokenPaddingSpan);
            }
        }
        return tokenizationDiv;
    };

    ConcreteWidgets.createTokenizationDiv.defaultOptions = {
        'convertTreebankBrackets': true,
        'whitespaceTokenization': false,
    };

    /**
     * Returns a boolean indicating if a Concrete Object (e.g. Section, Sentence, Token)
     * uses an (optional) TextSpan field.
     *
     * @param {Concrete Object} concreteObject
     * @returns {Boolean}
     */
    function concreteObjectUsesTextSpans(concreteObject) {
        if (concreteObject &&
            concreteObject.textSpan &&
            concreteObject.textSpan.start &&
            concreteObject.textSpan.ending) {
            return true;
        }
        else {
            return false;
        }
    }

    /** Function takes a token string, returns a "cleaned" version of that string
     *  with Penn Treebank-style bracket symbols replaced with actual bracket symbols.
     *
     * @param {String} tokenText
     * @returns {String}
     */
    function convertTreebankBrackets(tokenText) {
        // Convert Penn Treebank-style symbols for brackets to bracket characters
        //   http://www.cis.upenn.edu/~treebank/tokenization.html
        switch(tokenText) {
        case '-LRB-':
            return '(';
        case '-RRB-':
            return ')';
        case '-LSB-':
            return '[';
        case '-RSB-':
            return ']';
        case '-LCB-':
            return '{';
        case '-RCB-':
            return '}';
        default:
            return tokenText;
        }
    }

    /**
     * Returns a boolean indicating if a Tokenization's Tokens use (optional) TextSpans
     * @param {Tokenization} tokenization
     * @returns {Boolean}
     */
    function tokenizationUsesTextSpans(tokenization) {
        // We currently assume that if the first Token has a TextSpan, all Tokens have TextSpans
        return concreteObjectUsesTextSpans(tokenization.tokenList.tokenList[0]);
    }

    return ConcreteWidgets;
})();


(function($) {
    $.fn.addAllEntityMentionsInCommunication = function(communication) {
        if (communication && communication.entityMentionSetList && communication.entityMentionSetList.length > 0) {
            for (var i = 0; i < communication.entityMentionSetList.length; i++) {
                $.fn.addEntityMentionSet(communication.entityMentionSetList[i]);
            }
        }
        return this;
    };

    $.fn.addEntityMention = function(entityMention) {
        $.fn.getEntityMentionElements(entityMention)
            .addClass('entity_mention entity_mention_' + entityMention.uuid.uuidString);
        return this;
    };

    $.fn.addEntityMentionSet = function(entityMentionSet) {
        if (entityMentionSet && entityMentionSet.mentionList && entityMentionSet.mentionList.length > 0) {
            for (var i = 0; i < entityMentionSet.mentionList.length; i++) {
                $.fn.addEntityMention(entityMentionSet.mentionList[i]);
            }
        }
        return this;
    };

    $.fn.communicationWidget = function(communication, options) {
        this.append(ConcreteWidgets.createCommunicationDiv(communication, options));
        return this;
    };

    $.fn.getSentenceElements = function(sentence) {
        return this.find('.sentence.sentence_' + sentence.uuid.uuidString);
    };

    $.fn.getTokenRefSequenceElements = function(tokenRefSequence) {
        if (!tokenRefSequence && !tokenRefSequence.tokenizationId) {
            return $();
        }

        var tokenSelectorStrings = [];
        for (var i = 0; i < tokenRefSequence.tokenIndexList.length; i++) {
            tokenSelectorStrings.push(
                '.tokenization_' + tokenRefSequence.tokenizationId.uuidString +
                    '_' + tokenRefSequence.tokenIndexList[i]);
        }

        var tokenizationObject = $('.tokenization_' + tokenRefSequence.tokenizationId.uuidString);
        var tokenObjects = tokenizationObject.find(tokenSelectorStrings.join(', '));

        return tokenObjects;
    };

    $.fn.getEntityMentionElements = function(entityMention) {
        return $.fn.getTokenRefSequenceElements(entityMention.tokens);
    };

    $.fn.sectionWidget = function(section, options) {
        this.append(ConcreteWidgets.createSectionDiv(section, options));
        return this;
    };

    $.fn.sentenceWidget = function(sentence, options) {
        this.append(ConcreteWidgets.createSentenceDiv(sentence, options));
        return this;
    };

    $.fn.tokenizationWidget = function(tokenization, options) {
        this.append(ConcreteWidgets.createTokenizationDiv(tokenization, options));
        return this;
    };

})(jQuery);
