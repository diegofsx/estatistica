// iVProg - www.usp.br/line/ivprog
// LInE - Free Education, Private Data

// Function to read parameters informed by iAssign (URL)
// It is not mandatory to any iLM, but could be usefull to read special parameters
function getParameterByName (name, defaultReturn = null) {
  var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : defaultReturn;
}

// To create object with parameters informed by iAssign
// To each parameter is performed a calling to the getParameterByName method (above)
var iLMparameters = {
  iLM_PARAM_ServerToGetAnswerURL: getParameterByName("iLM_PARAM_ServerToGetAnswerURL"),
  iLM_PARAM_SendAnswer: getParameterByName("iLM_PARAM_SendAnswer"),
  iLM_PARAM_AssignmentURL: getParameterByName("iLM_PARAM_AssignmentURL"),
  iLM_PARAM_Assignment: getParameterByName("iLM_PARAM_Assignment"),
  iLM_PARAM_TeacherAutoEval: getParameterByName("iLM_PARAM_TeacherAutoEval"),
  lang: getParameterByName("lang", "pt")
};

// Set the lang parameter to the localStorage for easy access
// and no dependency to the global scope, avoind future 'strict mode' problems
//localStorage.setItem('ivprog.lang', iLMparameters.lang);

function removeCollapseValue (command) {
  if (command.collapsed) {
    delete command.collapsed;
  }
  if (command.type == 'iftrue') {
    if (command.commands_block)
      for (var i = 0; i < command.commands_block.length; i++) {
        removeCollapseValue(command.commands_block[i]);
      }
    if (command.commands_else)
      for (var i = 0; i < command.commands_else.length; i++) {
        removeCollapseValue(command.commands_else[i]);
      }
  } else if (command.type == 'repeatNtimes' || command.type == 'whiletrue' || command.type == 'dowhiletrue' ) {
    if (command.commands_block)
      for (var i = 0; i < command.commands_block.length; i++) {
        removeCollapseValue(command.commands_block[i]);
      }
  }
}

function configAuxiliar (form_element) {
  var _array = form_element.serializeArray();
  var temp = _array.reduce(function(map, obj) {
    map[obj.name] = obj.value == "on";
    return map;
  }, {});

  return temp;
}

function configAuxiliarProgrammingType (form_element) {
  var _array = form_element.serializeArray();
  var temp = _array.reduce(function(map, obj) {
    map[obj.name] = obj.value;
    return map;
  }, {});

  return temp;
}

// This is one of 2 essencial funcions to any iLM
// This function allow iAssign to call iLM (here iVProg) to return the student answer
// It is also used when teacher is finishing the iAssign activity
// The returned answer will be registered by Moodle through iAssign
function getAnswer () {

  var objAnswer = new Object();
  objAnswer.version = '1.0';

  // If parameter "iLM_PARAM_SendAnswer" is false,
  // then it the case of one answer to the activity
  if (iLMparameters.iLM_PARAM_SendAnswer == 'false') {
    // Build the text with the student answer

    objAnswer.code = generator();
    objAnswer.test_cases = ivprogCore.getTestCases();
    objAnswer.logs = ivprogCore.getLogs();
    try {
      objAnswer.settings = {
        "programming": Object.fromEntries(ivprogCore.Config.activity_programming_type),
        "functions": Object.fromEntries(ivprogCore.Config.activity_functions),
        "datatypes": Object.fromEntries(ivprogCore.Config.activity_datatypes),
        "commands": Object.fromEntries(ivprogCore.Config.activity_commands),
        "filter": Object.fromEntries(ivprogCore.Config.activity_filter)
      };
    }
    catch(e) {
      objAnswer.settings = {
        "programming": [],
        "functions": [],
        "datatypes": [],
        "commands": [],
        "filter": []
      };
    }

    return JSON.stringify(objAnswer, null, 4);

  } else {

    objAnswer.test_cases = prepareTestCases();

    objAnswer.settings = {
      "programming": configAuxiliarProgrammingType($('form[name="settings_programming_type"]')),
      "functions": configAuxiliar($('form[name="settings_functions"]')),
      "datatypes": configAuxiliar($('form[name="settings_data_types"]')),
      "commands": configAuxiliar($('form[name="settings_commands"]')),
      "filter": configAuxiliar($('form[name="settings_filter"]'))
    };

    if ($("input[name='include_algo']").is(':checked')) {
      objAnswer.algorithm = generator();
    }

    return JSON.stringify(objAnswer, null, 4);
  }
}

function prepareTestCases () {

  var test_cases_array = $('form[name="test_cases"]').serializeArray();

  var cases = [];

  for (var i = 0; i < test_cases_array.length; i = i + 2) {

    var temp = new Object();

    temp.input = [];
    temp.output = [];

    var inps = test_cases_array[i].value.match(/[^\r\n]+/g);
    if (inps) {
      for (var j = 0; j < inps.length; j++) {
        temp.input.push(inps[j]);
      }
    }
    
    var outs = test_cases_array[i+1].value.match(/[^\r\n]+/g);
    if (outs) {
      for (var j = 0; j < outs.length; j++) {
        temp.output.push(outs[j]);
      }
    }

    cases.push(temp);
  }
  
  return cases;
}

// This is one of 2 essencial funcions to any iLM
// This function is called by iAssign to get access to the student grade in the activity
// The returned value must be between 0 and 1 (real)
function getEvaluation () {
  if (iLMparameters.iLM_PARAM_SendAnswer == 'false') {
    // The code bellow is mandatory to the iLM
    // Observe that the calls is originated here (in the iLM) to the iAssign
    //x parent.getEvaluationCallback(window.studentGrade);
    var canRunAssessment = runCodeAssessment();
    if(canRunAssessment === -1) {
      parent.getEvaluationCallback(-1);
    }
  }
}

//var testCases = null
var settingsDataTypes = null;
var settingsCommands = null;
var settingsFunctions = null;
var settingsProgrammingTypes = null;
var settingsFilter = null;
var algorithm_in_ilm = null;
var previousContent = null;

// Function to iLM read content provided by iAssign
function getiLMContent () {
  // The parameter "iLM_PARAM_Assignment" provides the URL where AJAX must get the file content (*.ivph)
  $.get(iLMparameters.iLM_PARAM_Assignment, function (data) {
    // Teacher calls the automatic evaluation to exercices block
    if (iLMparameters.iLM_PARAM_TeacherAutoEval != null) {
        teacherAutoEval(data);
        // do not presents any interface (background process)
        return;
    } else if (iLMparameters.iLM_PARAM_SendAnswer == 'false' || iLMparameters.iLM_PARAM_SendAnswer == undefined) {
        // Student is working in one activity
        previousContent = data;
        prepareActivityToStudent(data);
    } else { // Teacher is editing one activity
        // console.log("getiLMContent(): iLMparameters.iLM_PARAM_SendAnswer=" + iLMparameters.iLM_PARAM_SendAnswer);
        previousContent = data;
        prepareActivityToEdit(data);
    }

    window.block_render = false;
    renderAlgorithm();
  });
}

function prepareActivityToEdit (ilm_cont) {
  //var content = JSON.parse(ilm_cont.split('\n::algorithm::')[0]);
  // See file 'js/util/iassignHelpers.js'
  var content = ivprogCore.prepareActivityToStudentHelper(ilm_cont).getOrElse(null);
  if (!content) {
    showInvalidData();
    return;
  }
  var testCases = ivprogCore.getTestCases();

  settingsProgrammingTypes = content.settingsProgrammingType;
  settingsDataTypes = content.settingsDataTypes;
  settingsCommands = content.settingsCommands;
  settingsFunctions = content.settingsFunctions;
  settingsFilter = content.settingsFilter;

  if (testCases==undefined || testCases=="")
    console.error("iassign-integration-functions.js: prepareActivityToEdit(.): testCases undefined...");
  else {
    for (var i = 0; i < testCases.length; i++) { addTestCase(testCases[i]); }
    }

  if (content.algorithmInIlm != null) {
    algorithm_in_ilm = content.algorithmInIlm;
    $("input[name='include_algo']").prop('checked', true);
    includePreviousAlgorithm();
    renderAlgorithm();
  }

  ivprogTextualOrVisual();
  if (settingsFilter && settingsFilter[0]) {
    blockAllEditingOptions();
  }
}

function parsePreviousAlgorithm () {
  window.program_obj.functions = JSON.parse(algorithm_in_ilm).functions;
  window.program_obj.globals = JSON.parse(algorithm_in_ilm).globals;
}

function includePreviousAlgorithm () {
  if (settingsProgrammingTypes == "textual") {
    return;
  }

  parsePreviousAlgorithm();

  window.watchW.watch(window.program_obj.globals, function(){
    if (window.insertContext) {
      setTimeout(function(){ renderAlgorithm(); }, 300);
      window.insertContext = false;
    } else {
      renderAlgorithm();
    }
  }, 1);

  for (var i = 0; i < window.program_obj.functions.length; i ++) {
    window.watchW.watch(window.program_obj.functions[i].parameters_list, function(){
      if (window.insertContext) {
        setTimeout(function(){ renderAlgorithm(); }, 300);
        window.insertContext = false;
      } else {
        renderAlgorithm();
      }
    }, 1);

    window.watchW.watch(window.program_obj.functions[i].variables_list, function(){
      if (window.insertContext) {
        setTimeout(function(){ renderAlgorithm(); }, 300);
        window.insertContext = false;
      } else {
        renderAlgorithm();
      }
    }, 1);

    if (window.program_obj.functions[i].is_main) {
      window.program_obj.functions[i].name = LocalizedStrings.getUI("start");
    }
  }

  window.watchW.watch(window.program_obj.functions, function(){
    if (window.insertContext) {
      setTimeout(function(){ renderAlgorithm(); }, 300);
      window.insertContext = false;
    } else {
      renderAlgorithm();
    }
  }, 1);
}

function prepareActivityToStudent (ilm_cont, ignore_logs = false) {
  // File version (1.0):
  try {
    var jsonObj = JSON.parse(ilm_cont);
    ivprogCore.prepareActivityToStudentHelperJSON(jsonObj);

    if (ivprogCore.getTestCases()) {
      //D console.log("iassign-integration-functions.js!prepareActivityToStudent(.): ivprogCore.getTestCases");
      $('.assessment_button').removeClass('disabled'); // remove 'disable' from evaluation button
      }

    renderAlgorithm();

    $('.ivprog_visual_panel').removeClass("loading");
    return;
  }  catch (e) {
    console.log('iassign-integration-functions.js: Previous file format!');
    console.log(e);
    console.log(ilm_cont); //D
    }

  // Previous file format:
  // Ver arquivo js/util/iassignHelpers.js
  var content = ivprogCore.prepareActivityToStudentHelper(ilm_cont, ignore_logs).getOrElse(null);
  if (!content) {
    $('.ivprog_visual_panel').removeClass("loading");
    showInvalidData();
    console.log('iassign-integration-functions.js: empty content!');
    return;
    }

  // Now the "test-cases" are submitted to analysis of iLM/iVProg (using the abouve "includePreviousAlgorithm(.)" function
  //var testCases = content.testcases; // not defined in 'js/util/iassignHelpers.js'
  try { // js/util/iassignHelpers.js : settingsProgrammingType ; settingsDataTypes ; settingsCommands ; settingsFunctions ; algorithmInIlm ; settingsFilter
    settingsProgrammingTypes = content.settingsProgrammingType; // js/visualUI/functions.js : settingsProgrammingTypes == "textual" (or "visual")
    settingsDataTypes = content.settingsDataTypes; // "settings_data_types"
    settingsCommands = content.settingsCommands;   // "settings_commands"
    settingsFunctions = content.settingsFunctions; // "settings_functions"
    settingsFilter = content.settingsFilter;       // ""
    //testCases = content.testcases;
  } catch (ex) {
    console.log("iassign-integration-functions.js: Error! Not defined field of 'content' " + ex);
    console.trace(); //D print execution stack
    }

  if (content.algorithmInIlm != null) {
    algorithm_in_ilm = content.algorithmInIlm;
    includePreviousAlgorithm();
    }
  console.log("iassign-integration-functions.js!prepareActivityToStudent(.): assessment_button?");
  $('.assessment_button').removeClass('disabled'); // with this command, all old format ivph file will enter with evaluation button enabled!!!
  $('.ivprog_visual_panel').removeClass("loading");
  renderAlgorithm();

  ivprogTextualOrVisual();
  if (settingsFilter && settingsFilter[0]) {
    blockAllEditingOptions();
    }
  }

// Used to organize the creation, visualization or resolution of each activity
function prepareEnvironment () {
  $('.div_to_body').click(function(e) {
    // trackingMatrix.push(adCoords(e, 1));
    ivprogCore.registerClick(e.pageX, e.pageY, e.target.classList['value']);
  });

  // If 'iLM_PARAM_SendAnswer' is false, then it is the resolution of an activity,
  // in this case, the "div" to resolution is presented
  if (iLMparameters.iLM_PARAM_SendAnswer == 'false') {
    //$('.resolucao').css("display","block");
    $('.ivprog_visual_panel').addClass("loading");

    getiLMContent();

    // $('.div_to_body').mousemove(function(e) {
    //     trackingMatrix.push(adCoords(e, 0));
    // });

    // $('.div_to_body').click(function(e) {
    //   // trackingMatrix.push(adCoords(e, 1));
    //   ivprogCore.registerClick(e.pageX, e.pageY, e.target.classList['value']);
    // });
  } else if (iLMparameters.iLM_PARAM_Assignment) {
    // If it is not an activity resolution, then the visualization mode must be "template construction"
    //$('.elaboracao').css("display","block");

    // If 'iLMparameters.iLM_PARAM_Assignment' parameter is present,
    // then the teacher is editing the activity
    getiLMContent();
  } else {
    renderAlgorithm();
  }

  if ((iLMparameters.iLM_PARAM_AssignmentURL == "true") && (iLMparameters.iLM_PARAM_SendAnswer == "true")) {
    prepareActivityCreation();
  }
}

function blockAllEditingOptions () {
  if ((iLMparameters.iLM_PARAM_AssignmentURL == "true") && (iLMparameters.iLM_PARAM_SendAnswer == "true")) {
    return;
  }

  $('.add_global_button').addClass('disabled');
  $('.move_function').addClass('disabled');
  $('.add_function_button').addClass('disabled');
  $('.add_var_button_function .ui.icon.button.purple').addClass('disabled');
  $('.add_var_button_function').addClass('disabled');
  $('.menu_commands').addClass('disabled');

  $('.global_type').addClass('disabled');
  $('.editing_name_var').addClass('disabled');
  $('.span_value_variable').addClass('disabled');

  $('.remove_global').addClass('disabled');
  $('.ui.icon.ellipsis.vertical.inverted').addClass('disabled');

  $('.alternate_constant').addClass('disabled');
  $('.remove_variable').addClass('disabled');

  $('.add_global_matrix_column').addClass('disabled');
  $('.remove_global_matrix_column').addClass('disabled');

  $('.add_global_matrix_line').addClass('disabled');
  $('.remove_global_matrix_line').addClass('disabled');

  $('.add_global_vector_column').addClass('disabled');
  $('.remove_global_vector_column').addClass('disabled');

  $('.add_expression').addClass('disabled');
  $('.add_parentheses').addClass('disabled');

  $('.remove_function_button').addClass('disabled');
  $('.button_remove_command').addClass('disabled');

  $('.command_drag').addClass('disabled');
  $('.simple_add').addClass('disabled');

  $('.add_parameter_button').addClass('disabled');
  $('.parameter_div_edit').addClass('disabled');
  $('.function_name_div_updated').addClass('disabled');
  $('.value_rendered').addClass('disabled');
  $('.var_name').addClass('disabled');
  $('.variable_rendered').addClass('disabled');

  $('.dropdown').addClass('disabled');
  $('.remove_parameter').addClass('disabled');

  $('.ui.dropdown.global_type.disabled').css('opacity', '1');
  $('.ui.dropdown.variable_type.disabled').css('opacity', '1');
  $('.ui.dropdown.function_return.disabled').css('opacity', '1');
  $('.ui.dropdown.parameter_type.disabled').css('opacity', '1');

  ivprogCore.CodeEditor.disable(true);
}


function ivprogTextualOrVisual () {
  if (settingsProgrammingTypes) {
    if (settingsProgrammingTypes == "textual") {
      $('.ivprog_visual_panel').css('display', 'none');
      $('.ivprog_textual_panel').css('display', 'block');
      $('.ivprog_textual_panel').removeClass('loading');

      $('.visual_coding_button').removeClass('active');
      $('.textual_coding_button').addClass('active');
      $('.visual_coding_button').addClass('disabled');

      let textual_code = algorithm_in_ilm;
      if(!textual_code) {
        textual_code = ivprogCore.LocalizedStrings.getUI("initial_program_code");
        textual_code = textual_code.replace(/\\n/g,"\n");
        textual_code = textual_code.replace(/\\t/g,"\t");
      }
      
      ivprogCore.CodeEditor.setCode(textual_code);
      ivprogCore.CodeEditor.disable(false);
    }
    if (settingsProgrammingTypes == "visual") {

    }
  }
}

function iassingIntegration () {
  // Disable by default...
  $('.assessment_button').addClass('disabled');

  prepareEnvironment();
  if (inIframe()) {
    orderIcons();
    orderWidth();
  }
}

// To prepare the teacher's interface to create a new activity:
function prepareActivityCreation () {
  var menuTab = $('<div class="ui top attached tabular menu">'
        + '<a class="item active" data-tab="testcases">' + LocalizedStrings.getUI('text_teacher_test_case') + '</a>'
        + '<a class="item" data-tab="algorithm">' + LocalizedStrings.getUI('text_teacher_algorithm') + '</a>'
        + '<a class="item" data-tab="settings">' + LocalizedStrings.getUI('text_teacher_config') + '</a>'
        + '</div>'
        + '<div class="ui bottom attached tab segment active tab_test_cases" data-tab="testcases"></div>'
        + '<div class="ui bottom attached tab segment tab_algorithm" data-tab="algorithm"></div>'
        + '<div class="ui bottom attached tab segment tab_settings" data-tab="settings"></div>');

  menuTab.insertBefore('.add_accordion');
  $('.tabular.menu .item').tab();

  $('.main_title').remove();
  $('.ui.accordion').addClass('styled');

  $('<div class="content_margin"></div>').insertBefore($('.add_accordion').find('.content').find('.div_to_body'));

  $('<div class="ui checkbox"><input type="checkbox" name="include_algo" class="include_algo" tabindex="0" class="hidden"><label>'+LocalizedStrings.getUI('text_teacher_algorithm_include')+'</label></div>').insertAfter('.content_margin');

  var cases_test_div = $('<div></div>');

  $('.tab_test_cases').append(cases_test_div);

  var config_div = $('<div></div>');

  $('.tab_settings').append(config_div);

  $('.ui.checkbox').checkbox();

  $('.tab_algorithm').append($('.add_accordion'));

  prepareTableSettings(config_div);

  prepareTableTestCases(cases_test_div);

  if (inIframe()) {
      $('.ui.styled.accordion').css('width', '96%');
  }
}

function prepareTableTestCases (div_el) {

  var table_el = '<form name="test_cases"><table class="ui blue table"><thead><tr><th width="30px">#</th><th>'+LocalizedStrings.getUI('text_teacher_test_case_input')+'</th><th>'+LocalizedStrings.getUI('text_teacher_test_case_output')+'</th><th width="80px">'+LocalizedStrings.getUI('text_teacher_test_case_actions')+'</th></tr></thead>'
    + '<tbody class="content_cases"></tbody></table></form>';

  div_el.append(table_el);

  var table_buttons = '<table class="table_buttons"><tr><td>'
    + '<button class="ui teal labeled icon button button_add_case"><i class="plus icon"></i>'+LocalizedStrings.getUI('text_teacher_test_case_add')+'</button>'
    + '</td><td class="right_align">'
    + '<button class="ui orange labeled icon button button_generate_outputs"><i class="sign-in icon"></i>'+LocalizedStrings.getUI('text_teacher_generate_outputs')+'</button>'
    + '</td></tr></table>';

  div_el.append(table_buttons);

  div_el.append($('<div class="ui basic modal"><div class="content"><p>Olá</p></div><div class="actions"><div class="ui green ok inverted button">Fechar</div></div></div>'));

  $('.button_add_case').on('click', function(e) {
    addTestCase();
  });
  $('.button_generate_outputs').on('click', function(e) {
    generateOutputs();
  });

  if (!iLMparameters.iLM_PARAM_Assignment)
    addTestCase();
}

function showAlert (msg) {
  $('.ui.basic.modal .content').html('<h3>'+msg+'</h3>');
  $('.ui.basic.modal').modal('show');
}

function generateOutputs () {
  if (window.program_obj.functions.length == 1 && window.program_obj.functions[0].commands.length == 0) {
    showAlert(LocalizedStrings.getUI('text_teacher_generate_outputs_algorithm'));
    return;
  }
  // To generate template code:
  var code_teacher = window.generator();
  // array with the test-cases:
  var test_cases = prepareTestCases();
  ivprogCore.autoGenerateTestCaseOutput(code_teacher, test_cases).catch(function (error) {
    showAlert("There was an error in your iVProg code: " + error.message);
  });

}

function outputGenerated (test_cases) {
  var fields = $('.text_area_output');
  //_ for (var i = 0; i < test_cases.length; i++) {
  //_   $(fields[i]).val('');
  //_   for (var j = 0; j < test_cases[i].output.length; j++) {
  //_     $(fields[i]).val($(fields[i]).val() + test_cases[i].output[j]);
  //_     if (j < test_cases[i].output.length - 1) {
  //_       $(fields[i]).val($(fields[i]).val() + '\n');
  //_     }
  //_   }
  //_   $(fields[i]).attr('rows', test_cases[i].output.length);
  //_ }
  animateOutput(fields, test_cases, 0);
}

function animateOutput (list, test_cases, index) {
  if (list.length == index) return;
  $(list[index]).val('');
  for (var j = 0; j < test_cases[index].output.length; j++) {
    console.log(test_cases[index].output[j].charCodeAt(0));
    $(list[index]).val($(list[index]).val() + test_cases[index].output[j]);
    if (j < test_cases[index].output.length - 1) {
      $(list[index]).val($(list[index]).val() + '\n');
    }
  }
  $(list[index]).attr('rows', test_cases[index].output.length);

  $(list[index]).effect('highlight', null, 50, function() {
    animateOutput(list, test_cases, index + 1);
  });
}

var hist = false;

function addTestCase (test_case = null) {
  var new_row = null;
  if (test_case) {
    var text_row = '';

    text_row += '<tr><td class="counter"></td><td class="expandingArea"><textarea rows="'+test_case.input.length+'" name="input" class="text_area_input">';

    for (var i = 0; i < test_case.input.length; i ++) {
      text_row += test_case.input[i];
      if ((i + 1) < test_case.input.length) {
        text_row += '\n';
      }
    }

    text_row += '</textarea></td><td class="expandingArea"><textarea rows="'+test_case.output.length+'" name="output" class="text_area_output">';

    for (var i = 0; i < test_case.output.length; i ++) {
      text_row += test_case.output[i];
      if ((i + 1) < test_case.output.length) {
        text_row += '\n';
      }
    }

    text_row += '</textarea></td><td class="btn_actions"><div class="ui button_remove_case"><i class="red icon times large"></i></div></td></tr>';

    new_row = $(text_row);
  } else {
      new_row = $('<tr><td class="counter"></td><td class="expandingArea"><textarea rows="1" name="input" class="text_area_input"></textarea></td><td class="expandingArea"><textarea rows="1" name="output" class="text_area_output"></textarea></td><td class="btn_actions"><div class="ui button_remove_case"><i class="red icon times large"></i></div></td></tr>');
  }
  $('.content_cases').append(new_row);

  new_row.find('.button_remove_case').click(function(e) {
      new_row.remove();
      updateTestCaseCounter();
  });

  new_row.find('textarea').on('input', function(e) {
      var lines = $(this).val().split('\n').length;
      $(this).attr('rows', lines);
  });

  updateTestCaseCounter();

  $('.text_area_output').keydown(function(e) {
    var code = e.keyCode || e.which;
    if (code == 9 && $(this).closest("tr").is(":last-child")) {
      hist = true;
      addTestCase();
    }
  });
  if (test_case == null) {
    if (!hist) {
      $( ".content_cases tr:last" ).find('.text_area_input').focus();
    } else {
      hist = false;
    }
  }
}

function updateTestCaseCounter () {
    var i = 1;
    $( ".content_cases" ).find('tr').each(function() {
      $( this ).find('.counter').text(i);
      ++i;
    });
}


function prepareTableSettings (div_el) {

  div_el.append('<div class="ui segment settings_topic"><h3 class="ui header"><i class="window maximize outline icon"></i><div class="content">'+LocalizedStrings.getUI('text_config_programming')+'</div></h3>'
    +'<div class="content content_segment_settings"><form name="settings_programming_type"><div class="ui stackable five column grid">'
    +'<div class="column"><div class="ui radio"><input type="radio" name="programming_type" id="programming_textual" value="textual" tabindex="0" class="hidden small"><label for="programming_textual">'+LocalizedStrings.getUI('text_config_programming_textual')+'</label></div></div>'
    +'<div class="column"><div class="ui radio"><input type="radio" name="programming_type" id="programming_visual" value="visual" checked tabindex="0" class="hidden small"><label for="programming_visual">'+LocalizedStrings.getUI('text_config_programming_visual')+'</label></div></div>'
    +'</div></form></div></div>');

  div_el.append('<div class="ui segment settings_topic"><h3 class="ui header"><i class="qrcode icon"></i><div class="content">'+LocalizedStrings.getUI('text_teacher_data_types')+'</div></h3>'
    +'<div class="content content_segment_settings"><form name="settings_data_types"><div class="ui stackable five column grid">'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="integer_data_type" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('type_integer')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="real_data_type" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('type_real')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="text_data_type" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('type_text')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="boolean_data_type" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('type_boolean')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="void_data_type" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('type_void')+'</label></div></div>'
    +'</div></form></div></div>');

  div_el.append('<div class="ui segment settings_topic"><h3 class="ui header"><i class="code icon"></i><div class="content">'+LocalizedStrings.getUI('text_teacher_commands')+'</div></h3>'
    +'<div class="content content_segment_settings"><form name="settings_commands"><div class="ui stackable three column grid">'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_read" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_read_var')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_write" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_write_var')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_comment" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_comment')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_attribution" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_attribution')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_functioncall" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_functioncall')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_iftrue" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_iftrue')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_repeatNtimes" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_repeatNtimes')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_while" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_whiletrue')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_dowhile" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_dowhiletrue')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="commands_switch" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_switch')+'</label></div></div>'
    +'</div></form></div></div>');

  div_el.append('<div class="ui segment settings_topic"><h3 class="ui header"><i class="terminal icon"></i><div class="content">'+LocalizedStrings.getUI('text_teacher_functions')+'</div></h3>'
    +'<div class="content content_segment_settings"><form name="settings_functions"><div class="ui stackable one column grid">'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="functions_creation" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_teacher_create_functions')+'</label></div></div>'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="functions_move" checked tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_teacher_create_movement_functions')+'</label></div></div>'
    +'</div></form></div></div>');

  div_el.append('<div class="ui segment settings_topic"><h3 class="ui header"><i class="filter icon"></i><div class="content">'+LocalizedStrings.getUI('text_teacher_filter')+'</div><i class="circular inverted teal question icon"></i></h3>'
    +'<div class="content content_segment_settings"><form name="settings_filter"><div class="ui stackable one column grid">'
    +'<div class="column"><div class="ui checkbox"><input type="checkbox" name="filter_active" tabindex="0" class="hidden small"><label>'+LocalizedStrings.getUI('text_teacher_filter_active')+'</label></div></div>'
    +'</div></form></div></div>');

  $('.circular.inverted.teal.question.icon').popup({
    content : LocalizedStrings.getUI("text_teacher_filter_help"),
    delay: { show: 750, hide: 0 }
  });

  $('.ui.checkbox').checkbox();

}

function orderWidth() {
  $('.ui.raised.container.segment.div_to_body').css('width', '100%');
  $('.ui.one.column.container.segment.ivprog_visual_panel').css('width', '100%');
}

function orderIcons() {
  $('.ui.one.column.doubling.stackable.grid.container').css('display', 'none');
  $('.only_in_frame').css('display', 'block');
}


function inIframe () {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}


function full_screen() {
  // check if user allows full screen of elements. This can be enabled or disabled in browser config. By default its enabled.
  //its also used to check if browser supports full screen api.
  if("fullscreenEnabled" in document || "webkitFullscreenEnabled" in document || "mozFullScreenEnabled" in document || "msFullscreenEnabled" in document) {
    if(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled) {
      var element = document.getElementById("ui_main_div");
      //requestFullscreen is used to display an element in full screen mode.
      if("requestFullscreen" in element) {
        element.requestFullscreen();
      }
      else if ("webkitRequestFullscreen" in element) {
        element.webkitRequestFullscreen();
      }
      else if ("mozRequestFullScreen" in element) {
        element.mozRequestFullScreen();
      }
      else if ("msRequestFullscreen" in element) {
        element.msRequestFullscreen();
      }
    }
  } else {
    $('.expand_button').addClass('disabled');
  }
}

function getAutoEvalOriginalData () {
  return parent.getAutoEvalOriginalData();
}

function teacherAutoEval (data) {
  previousContent = data;
  // Ver arquivo js/util/iassignHelpers.js
  var content = ivprogCore.prepareActivityToStudentHelper(data).getOrElse(null);
  if (!content) {
    showInvalidData();
    return;
  }
  // Now the "test-cases" are submitted to analysis of iLM/iVProg (using the abouve "getAutoEvalOriginalData(.)" function
  // var testCases = content.testcases;
  settingsProgrammingTypes = content.settingsProgrammingType;
  settingsDataTypes = content.settingsDataTypes;
  settingsCommands = content.settingsCommands;
  settingsFunctions = content.settingsFunctions;
  settingsFilter = content.settingsFilter;

  if (content.algorithmInIlm != null) {
    algorithm_in_ilm = content.algorithmInIlm;
    parsePreviousAlgorithm();
    var originalData = getAutoEvalOriginalData();
    ivprogCore.autoEval(originalData, parent.postResultAutoEval);
  }

  ivprogTextualOrVisual();
  if (settingsFilter && settingsFilter[0]) {

    blockAllEditingOptions(); 
  }
}

function displayGrade(grade) {
  alert(grade);
}

function showInvalidData () {
  $('.ui.height_100.add_accordion').dimmer({
    closable: false
  });
  $('.dimmer_content_message h3').html(LocalizedStrings.getUI('text_message_error_activity_file'));
  $('.dimmer_content_message button').text(LocalizedStrings.getUI('text_message_error_activity_reload'));
  $('.dimmer_content_message').css('display', 'block');
  $('.ui.height_100.add_accordion').dimmer('add content', '.dimmer_content_message');
  $('.ui.height_100.add_accordion').dimmer('show');
  $('.dimmer_content_message button').on('click', function(e) {
    window.parent.location.reload()
  })
}

function showMessageDialog (msg = "") {
  $('.ui.height_100.add_accordion').dimmer({
    closable: false
  });
  $('.dimmer_content_message h3').html(msg);
  $('.dimmer_content_message button').text("OK");
  $('.dimmer_content_message').css('display', 'block');
  $('.ui.height_100.add_accordion').dimmer('add content', '.dimmer_content_message');
  $('.ui.height_100.add_accordion').dimmer('show');
  $('.dimmer_content_message button').on('click', function(e) {
    $('.ui.height_100.add_accordion').dimmer('hide');
  })
}

function showInvalidFile () {
  $('.ui.height_100.add_accordion').dimmer({
    closable: true
  });
  $('.dimmer_content_message h3').html(LocalizedStrings.getUI('text_message_error_upload_file'));
  $('.dimmer_content_message button').text(LocalizedStrings.getUI('text_message_error_upload_close'));
  $('.dimmer_content_message').css('display', 'block');
  $('.ui.height_100.add_accordion').dimmer('add content', '.dimmer_content_message');
  $('.ui.height_100.add_accordion').dimmer('show');
  $('.dimmer_content_message button').on('click', function(e) {
    $('.ui.height_100.add_accordion').dimmer('hide');
  })
}