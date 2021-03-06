/* globals AnnotationTaskType, CADET, SearchFeedback, SearchQuery,
           SearchType */

// Global variables
var SEARCH_RESULT_TABLE;
var SEARCH_RESULT;
var COMMS_MAP;

function createResultsTable() {
    SEARCH_RESULT_TABLE = $('#results_table').DataTable({
        buttons: [
            {
                action: function (e, dt, node, config, results) {
                    CADET.registerSearchResultWithGuard(SEARCH_RESULT);
                },
                text: 'Export'
            },
            {
                extend: 'colvis',
                text:'Toggle Columns'
            }
        ],
        columns: [
            {
                title: 'Feedback',
                className: 'feedback_buttons',
                render: function(data, type, searchResultItem) {
                    return '';
                },
                sortable: false,
                width: '1%'
            },
            {
                title: 'Communication&nbsp;ID',
                render: function(data, type, searchResultItem) {
                    return '<a href="quicklime/?id=' + searchResultItem.communicationId +
                           '">' + searchResultItem.communicationId + '</>';
                },
                // Using a width of 1% causes Chrome, Firefox and Safari to render
                // this column as narrow as possible while still being wide enough
                // to accommodate the column's title.  This does not actually
                // set the column width to be only 1% of the table width.  Without
                // this styling, the width of this column was taking up over half
                // of the width of the table when this column is shown by default.
                width: '1%'
            },
            {
                title: 'Sentence ID',
                render: function(data, type, searchResultItem) {
                    if (searchResultItem.sentenceId) {
                        return searchResultItem.sentenceId.uuidString;
                    }
                    else {
                        return '';
                    }
                },
                visible: false
            },
            {
                title: 'Score',
                render: function(data, type, searchResultItem) {
                    return searchResultItem.score;
                },
                visible: false
            },
            {
                title: 'Text',
                className: 'search_result_item_text',
                render: function(data, type, searchResultItem) {
                    if (type === 'display') {
                        // The render function can be called multiple times.  We only fetch
                        // the Communication when the render type is 'display'
                        //   https://datatables.net/reference/option/columns.render
                        try {
                            if (COMMS_MAP.has(searchResultItem.communicationId)) {
                                var comm = COMMS_MAP.get(searchResultItem.communicationId);
                                searchResultItem.sentence = comm.getSentenceWithUUID(searchResultItem.sentenceId);
                            } else {
                              var fetchResult = CADET.fetchComms([searchResultItem.communicationId]);
                              if (fetchResult.communications.length === 1) {
                                  searchResultItem.communication = fetchResult.communications[0];
                                  searchResultItem.communication.addInternalReferences();

                                  // searchResultItem.sentence will be null if searchResultItem.sentenceId is not valid
                                  searchResultItem.sentence = searchResultItem.communication.getSentenceWithUUID(
                                      searchResultItem.sentenceId);
                                  COMMS_MAP.set(searchResultItem.communicationId, searchResultItem.communication);
                              }
                            }
                        }
                        catch (error) {
                            displayAndThrowError(error);
                        }

                        var searchResultItemText = '';

                        if (searchResultItem.sentence) {
                            searchResultItemText = $('<span>').sentenceWidget(searchResultItem.sentence).text();
                        }
                        else {
                            if (searchResultItem.sentenceId) {
                                console.error('SearchResult specified an invalid sentenceId');
                            }
                            else {
                                displayErrorMessage('SearchResult did not include an (optional) sentenceId');
                                console.warn('SearchResult did not include an (optional) sentenceId');
                            }

                            if (!searchResultItem.communication) {
                                searchResultItemText = '<div class="alert alert-danger" role="alert" ' +
                                                       // Override margin-bottom for Bootstrap class 'alert-danger'
                                                       'style="font-style: italic; margin-bottom: 0px">' +
                                                       'Communication with ID "' +
                                                       searchResultItem.communicationId +
                                                       '" is not available' +
                                                       '</div>';
                            }
                            else {
                                var firstSentence = searchResultItem.communication.getFirstSentence();
                                if (firstSentence) {
                                    searchResultItemText = $('<span>').sentenceWidget(firstSentence).text();
                                }
                                else {
                                    console.warn('Communication did not contain any Sentences');
                                    searchResultItemText = searchResultItem.communication.text;
                                }
                            }
                        }

                        return searchResultItemText;
                    }
                    else { // type !== 'display'
                        return '';
                    }
                }
            }
        ],
        createdRow: function(row, searchResultItem, index) {
            // Add event handlers to DOM elements created by render()
            //
            // For more information about how to use DataTables' createdRow, see:
            //   https://datatables.net/examples/advanced_init/row_callback.html

            $('.feedback_buttons', row).append(
                // Feedback button group
                $('<div>')
                    .addClass('btn-group')
                    .attr('data-toggle', 'buttons')
                    .append(
                        // Positive feedback button
                        $('<label>')
                            .addClass('btn btn-default btn-sm glyphicon glyphicon-ok feedback')
                            .attr('data-polarity', 'pos')
                            .append(
                                $('<input>')
                                    .attr('type', 'radio')
                                    .attr('autocomplete', 'off'))
                            .on('click',
                                {'searchResultItem': searchResultItem, 'searchResult': SEARCH_RESULT},
                                saveSentenceFeedback))
                    .append(
                        // Negative feedback button
                        $('<label>')
                            .addClass('btn btn-default btn-sm glyphicon glyphicon-remove feedback')
                            .attr('data-polarity', 'neg')
                            .append(
                                $('<input>')
                                    .attr('type', 'radio')
                                    .attr('autocomplete', 'off'))
                            .on('click',
                                {'searchResultItem': searchResultItem, 'searchResult': SEARCH_RESULT},
                                saveSentenceFeedback)));

            var searchResultItemId = SEARCH_RESULT.uuid.uuidString + '_' + index;
            $('.search_result_item_text', row).attr('id', searchResultItem.communicationId)
               .on('click',
                   {
                       'searchResultItem': searchResultItem,
                       'searchResultItemId': searchResultItemId,
                   },
                   openSearchResultTab);
        },

        // The deferRender option allows "lazy loading" of Communications via fetch()
        //   https://datatables.net/examples/ajax/defer_render.html
        deferRender: true,

        // The options for 'dom' are documented here:
        //   https://datatables.net/reference/option/dom
        // We are currently using the options:
        //   B - Buttons
        //   r - processing display element
        //   t - table
        //   i - table information summary
        //   p - pagination control
        dom: 'Brtip',
        language: {
            emptyTable: 'No matching search results'
        },
    });
}

/**
 */
function createEntityMentionSearchMenu(event) {
    var searchResultItem = event.data.searchResultItem;

    var entityMentionList = [];
    for (var i = 0; i < this.classList.length; i++) {
        if (this.classList[i].startsWith('entity_mention_')) {
            var entityMentionId = this.classList[i].substring(15);
            var entityMention = searchResultItem.communication.getEntityMentionWithUUID({
                'uuidString': entityMentionId
            });
            entityMentionList.push(entityMention);
        }
    }

    var entityMentionListDiv = $('<div>');
    var tokenIndexSet = {};
    for (var j = 0; j < entityMentionList.length; j++) {
        var searchQuery = new SearchQuery();
        searchQuery.type = SearchType.ENTITY_MENTIONS;
        searchQuery.communicationId = searchResultItem.communicationId;
        searchQuery.communication = searchResultItem.communication;
        searchQuery.tokens = entityMentionList[j].tokens;
        searchQuery.userId = CADET.userId;

        // TODO: Modify src/main/java/edu/jhu/hlt/concrete/search/SearchHandler.java
        //       to not throw exceptions if rawQuery or terms are empty.
        searchQuery.terms = ["IGNORED"];
        searchQuery.rawQuery = "IGNORED";

        // Only add one list item per set of tokens.  A Communication may have multiple
        // EntityMentionSets, and so may have multiple EntityMentions that point to
        // the same set of tokens.
        if (!tokenIndexSet.hasOwnProperty(searchQuery.tokens.tokenIndexList)) {
            tokenIndexSet[searchQuery.tokens.tokenIndexList] = true;

            entityMentionListDiv.append(
                $('<li>').append(
                    $('<a>')
                        .css('cursor', 'pointer')
                        .on('click', {'searchQuery': searchQuery}, executeSearchQueryFromEntityMention)
                        .text(entityMentionList[j].text)));
        }
    }

    if ($(this).hasClass('popover_entity_mention_search')) {
        // Remove the current popover
        $(this).popover('destroy');
        $(this).removeClass('popover_entity_mention_search');
    }
    else {
        // Remove all popovers
        $(this).closest('.communication').find('.popover_entity_mention_search').popover('destroy');

        // Add and show new popover
        $(this).addClass('popover_entity_mention_search');
        $(this).popover({
            'content': entityMentionListDiv,
            'html': true,
            'placement': 'auto',
            'title': 'Entity Mention Search'
        });
        $(this).popover('show');
    }
}

function addResultToResultsTable(searchResult) {
    SEARCH_RESULT = searchResult;
    SEARCH_RESULT_TABLE.clear();
    if (searchResult.searchResultItems.length > 0) {
        SEARCH_RESULT_TABLE.rows.add(searchResult.searchResultItems);
    }
    SEARCH_RESULT_TABLE.draw();
}

function displayAndThrowError(error) {
    displayErrorMessage(error.message);
    throw error;
}

function displayErrorMessage(message) {
    $('#errors').html('<div class="alert alert-danger" role="alert">' + message + '</div>');
}

function executeSearchQuery(searchQuery) {
    // removes any previous error messages
    $('#errors').empty();

    if (CADET.defaultSearchProviders[CADET.getSearchTypeString(searchQuery.type)] === undefined) {
        displayErrorMessage('No search provider registered for search type ' +
                            CADET.getSearchTypeString(searchQuery.type));
        return;
    }

    var searchResult;
    try {
        if (searchQuery.type === SearchType.COMMUNICATIONS) {
            searchResult = CADET.search_proxy.search(searchQuery, CADET.defaultSearchProviders.COMMUNICATIONS);
        }
        else if (searchQuery.type === SearchType.ENTITY_MENTIONS) {
            searchResult = CADET.search_proxy.search(searchQuery, CADET.defaultSearchProviders.ENTITY_MENTIONS);
        }
        else if (searchQuery.type === SearchType.SENTENCES) {
            searchResult = CADET.search_proxy.search(searchQuery, CADET.defaultSearchProviders.SENTENCES);
        }
    }
    catch (error) {
        displayAndThrowError(error);
    }
    addResultToResultsTable(searchResult);

    $('a[href="#search_results"]').tab('show');
}

function executeSearchQueryEventHandler(event) {
    executeSearchQuery(event.data.searchQuery);
}

function executeSearchQueryFromEntityMention(event) {
    // Remove all popovers
    $(this).closest('.communication').find('.popover_entity_mention_search').popover('destroy');

    executeSearchQuery(event.data.searchQuery);
}

function executeSearchQueryFromSearchBox() {
    var searchInput = document.getElementById('user_search').value;
    var queryName =   document.getElementById('query_name').value;

    executeSearchQuery(CADET.createSearchQueryFromSearchString(searchInput, queryName));
}

/** Create a new tab containing the Communication text for a search result
 */
function openSearchResultTab(event) {
    var searchResultItem = event.data.searchResultItem;
    var searchResultItemId = event.data.searchResultItemId;

    // Add tab with Communication ID as title and an 'X' button for closing the tab
    $('#nav-tabs').append(
        $('<li>').append(
            $('<a>').attr('data-toggle', 'tab')
                    .attr('href', '#' + searchResultItemId)
                    .text(searchResultItem.communicationId)
                    .append(
                        // We are embedding the <span> with the remove ('X') link *in* the
                        // <a> link because of Bootstrap CSS rules that use the selectors
                        // ".nav-tabs>li>a" and ".nav>li>a".
                        $('<span>')
                            .addClass('glyphicon glyphicon-remove')
                            .css('margin-left', '0.5em')
                            .on('click', {'searchResultItemId': searchResultItemId}, function(event) {
                                // Remove the <div> with the tab content
                                $('#' + event.data.searchResultItemId).remove();
                                // Remove the tab
                                $(this).closest('li').remove();
                                // Show the Search Results tab
                                $('a[href="#search_results"]').tab('show');
                            }))));

    $('#tab-content').append('<div id="' + searchResultItemId +'" class="tab-pane"></div>');

    // Add content to <div> for the newly created tab
    if (searchResultItem.communication.getFirstSentence()) {
        // communicationWidget() will only render text if the Communication has Sentences
        var communicationDiv = $('<div>').communicationWidget(searchResultItem.communication);
        $('div #' + searchResultItemId).append(communicationDiv);

        // The Kelvin KB is built using Serif EntityMentions
        var serifMentionEMS = searchResultItem.communication.getEntityMentionSetWithToolname("Serif: mentions");
        if (serifMentionEMS) {
            communicationDiv.addEntityMentionSet(serifMentionEMS);
        }
//            communicationDiv.addAllEntityMentionsInCommunication(searchResultItem.communication);

        communicationDiv.find('.entity_mention').on(
            'click',
            {'searchResultItem': searchResultItem},
            createEntityMentionSearchMenu
        );
        if (searchResultItem.sentence) {
            communicationDiv.getSentenceElements(searchResultItem.sentence)
                            .addClass('selected_search_sentence');
        }
    }
    else {
        // If the Communication does not have Sentences, just display the .text field
        $('div #' + searchResultItemId).append($('<div>').text(searchResultItem.communication.text));
    }

    $('a[href="#'+ searchResultItemId +'"]').tab('show');
}

/** Interactively prompt user for login name until a non-empty string is entered.
 *  The CADET.userId variable is set to the string that the user enters.
 */
function promptForLoginName() {
    var userId = prompt('Please input your user ID:');
    if (typeof userId === 'string') {
        if (userId!=='') {
            $('#greeting').text('Hello, ' + userId);
            CADET.userId = userId;
        }
    }
}

function saveSentenceFeedback(event) {
    var searchResultItem = event.data.searchResultItem;
    var searchResult = event.data.searchResult;
    var searchResultId = searchResult.uuid;
    var communicationId = searchResultItem.communicationId;
    var sentenceId = searchResultItem.sentenceId;

    var feedback;
    if ($(this).data('polarity')==='pos'){
        feedback = SearchFeedback.POSITIVE;
    }
    else {
        feedback = SearchFeedback.NEGATIVE;
    }

    try {
        CADET.startFeedbackWithGuard(searchResult);
        CADET.feedback.addSentenceFeedback(searchResultId, communicationId, sentenceId, feedback);
    }
    catch (error) {
        displayAndThrowError(error);
    }
}

function updateServiceStatus() {
    var services = ['search_proxy', 'fetch', 'feedback'];
    var serviceStatusMessage = '';
    var unavailableServices = [];

    for (var index in services) {
        try {
            if (!CADET[services[index]].alive()) {
                unavailableServices.push(services[index]);
                serviceStatusMessage += '<li>The ' + services[index] + ' service is not alive</li>';
            }
        }
        catch (error) {
            unavailableServices.push(services[index]);
            serviceStatusMessage += '<li>Error when trying to connect to ' + services[index] + ' service: ' +
                                    error.name + ' - ' + error.message +
                                    '</li>';
        }
    }
    if (unavailableServices.length > 0) {
        displayErrorMessage(serviceStatusMessage);
    }
}

// initialize all CADET clients
CADET.init();
COMMS_MAP = new LRUMap(35);

$(document).ready(function() {
    updateServiceStatus();
    $('#greeting').on('click', promptForLoginName);

    // search box is focused on pageload
    $('#user_search').focus();

    // press enter key to trigger search button click handler
    $('#user_search, #query_name').bind('keypress', function(e) {
        if (e.keyCode===13) {
            executeSearchQueryFromSearchBox();
        }
    });
    createResultsTable();

    $('#search_button').on('click', executeSearchQueryFromSearchBox);
});
