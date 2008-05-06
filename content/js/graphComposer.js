var urlManager = Class.create();
urlManager.prototype = {
  initialize: function(baseUrl,initialConfig){
    //baseUrl for graphite: //initialConfig is either dict of key:[val,val...] or 'url', which tells urlMgr to pull from window.location
    this.baseUrl = baseUrl?baseUrl:window.location.href+"render/?"
    this.urlArgs = $H();
    this.urlAttributes = $H();
    this._o = new Ext.util.Observable();
    this._o.addEvents("urlexpanded");
    this._o.addEvents("urlreduced");
    this._o.addEvents("urlmodified"); //expand or reduce
    if(typeof initialConfig == "object"){this.prePopulate($H(initialConfig));}
    else if(initialConfig == "url"){
      var urlObj = this.scrubURL(); 
      this.prePopulate(urlObj);
    }
  },
  on: function(evtStr,func,scope,args){this._o.on(evtStr,func,scope,args);},
  un: function(evtStr,func,scope,args){this._o.un(evtStr,func,scope,args);},
  fireEvent: function(evtStr,args){this._o.fireEvent(evtStr,args);},
  scrubURL: function(href){
    if(!href){href = $H(Ext.urlDecode(window.location.href.split("?")[1]));}
    else{
      href = decodeURIComponent(href).split("?")[1];
      href = href[0] == "&"?href.slice(1):href;
      hrefHash = $H();
      href.split("&").each(function(item){
        item = item.split("=");
	hrefHash.set(item[0],item[1]);
      });
      href = hrefHash;
    }
    return href;
  },
  prePopulate: function(config){
    var mgr = this;
    config.keys().each(function(key){
      mgr.del(key); //avoid duplicates with default entries.
      if(!config.get(key).each){mgr.set(key,config.get(key));return;}
      config.get(key).each(function(item){mgr.set(key,item);});
    });
    var url = this.url();
    this.fireEvent("urlexpanded",url);
    this.fireEvent("urlmodified",url);
  },
  del: function(propertyName,index){
    //same as others, if !index, del all of type propertyName;
    var _this = this;
    if(index == null || index < 0){
      var retVal = this.urlArgs.unset(propertyName);
      if(!retVal){return;}
      return retVal;
    }
    var val = this.urlArgs.get(propertyName)[index];
    this.urlArgs.get(propertyName).splice(index,1);
    return val;
  },
  get: function(propertyName,index){
    //same general symantics as setUrlProperty
    if(index && this.urlArgs.get(propertyName)){return this.urlArgs.get(propertyName)[index];}
    if(!this.urlArgs.get(propertyName)){return null;}
    return this.urlArgs.get(propertyName)
  },
  getIndex: function(propertyName,value){
    if(!propertyName){if(!value){return -1;}}
    if(this.urlArgs.get(propertyName)){
      return this.urlArgs.get(propertyName).indexOf(value);
    }
    return -1;
  },
  set: function(propertyName,value,index){
    //if index, insert propertyName as index N, else append or create new.
    var pn = propertyName; //short hand
    if(index ==null || index < 0){
      if(!this.urlArgs.get(pn)){
        this.urlArgs.set(pn,[value]);
        return;
      }
      else{
        this.urlArgs.get(pn).push(value);
        return;
      }
    }
    else{
      if(!this.urlArgs.get(pn)){this.urlsArgs.set(pn,[]);}
      this.urlArgs.get(pn)[index] = value;
    }
  },
  reset: function(propertyName,value){
    this.del(propertyName);
    this.set(propertyName,value);
  },
  setAttribute: function(propertyName,propertyValue,attributeName,attributeValue){
    //attributes are data points about targets that do not show up in the url string
    //they can be used to store extra information about a target needed for logic purposes
    //but not directly for rendering purposes.
    var attribClass = propertyName+":"+propertyValue;
    if(this.urlAttributes.get(attribClass)){this.urlAttributes.get(attribClass).set(attributeName,attributeValue);}
    else{
      this.urlAttributes.set(attribClass,$H());
      this.urlAttributes.get(attribClass).set(attributeName,attributeValue);
    }
  },
  delAttribute: function(propertyName,propertyValue,attributeName){
    //attributeName optional. !attributeName == del all for propertyName+propertyValue
    var attribClass = propertyName+":"+propertyValue;
    var attribClassInst = this.urlAttributes.get(attribClass);
    if(!attribClassInst){return null;}
    if(attributeName != null){return attribClassInst.unset(attributeName);}
    else{return this.urlAttributes.unset(attribClass);}
  },
  getAttribute: function(propertyName,propertyValue,attributeName){
    var attribClass = propertyName+":"+propertyValue;
    if(!this.urlAttributes.get(attribClass)){return null;}
    if(attributeName == null){return this.urlAttributes.get(attribClass);}
    else{return this.urlAttributes.get(attribClass).get(attributeName);}
  },
  url: function(){
     //return string reprsenation of this object.
     var urlStrList = [this.baseUrl];
     this.urlArgs.each(function(urlArgList){
       var id = urlArgList[0];
       urlArgList[1].each(function(urlArg){
         urlStrList.push(id+"="+urlArg);
       });
     });
     return urlStrList.join("&").replace(/#/g,"%23");
  }
};

var composerControl = Class.create();
composerControl.prototype = {
  // controls provide the graphical interface to operate one or more graphComponents
  initialize: function(){
    //subclasses need to account for these properties
    //region - string area of graphComposer this control will be rendered
    //targets - list of composerComponents this control will
    //
    this.leftItems = [];
    this.rightItems = [];
    this.topItems = [];
    this.bottomItems = [];
    this.contexItems = [];
    this.urlMgr = null; //needs to be added by subclasses.
    //this is going to be a common pattern from now on to avoid ext subclassing silliness.
    this._o = new Ext.util.Observable();
    this._o.addEvents("controlrendered"); // allow inner controls to handle any preset logic.
  },
  on: function(evtStr,func,scope,args){this._o.on(evtStr,func,scope,args);},
  un: function(evtStr,func,scope,args){this._o.un(evtStr,func,scope,args);},
  fireEvent: function(evtStr,args){this._o.fireEvent(evtStr,args);},
  joinContext: function(){
    // -> [anyValid config items that can go in a Ext.Toolbar.add()]
    //these items will be placed in the right click context menu of the center of the graphComposer.
    return this.contextItems;
  },
  joinTop: function(){
    // -> [anyValid config items that can go in a Ext.Toolbar.add()]
    return this.topItems;
  },
  joinLeft: function(){
    // -> [anyValid config items that can go in a Ext.Toolbar.add()]
    return this.leftItems;
  },
  joinRight: function(){
    // -> [anyValid config items that can go in a Ext.Toolbar.add()]
    return this.rightItems;
  },
  joinBottom: function(){
    // -> [anyValid config items that can go in a Ext.Toolbar.add()]
    return this.bottomItems;
  },
  update: function(){
    //should provide full url string to caller.
    //this will be replaced by graphComposer class to provide feedback from 
    //components on url changes.
  },
  onComposerRender: function(composer){
    //generic callback used by composer upon rendering.
    //will also be called for controls added after composer is already rendered.
    this.fireEvent("controlrendered",{composer:composer,control:this});
  },
  //think of each of the following as mini classes that user requests an instance of.
  checkMenu: function(menuID,menuText,initChecked,checkedVal,uncheckedVal,target){
    var container = {};
    container.thisRef = this;
    container.checkedVal = checkedVal;
    container.uncheckedVal = uncheckedVal;
    container.target = target;
    var chkHandler = function(item,checked){
      if(checked){
	container.thisRef.urlMgr.reset(container.target,container.checkedVal);
      }
      else{container.thisRef.urlMgr.reset(container.target,container.uncheckedVal)}
      container.thisRef.update();
    };
    container.check = new Ext.menu.CheckItem({
      id:menuID,
      text:menuText,
      checked: initChecked,
      checkHandler: chkHandler
    });
    urlModHandler = function(){
      var mgr = container.thisRef.urlMgr;
      try{if(mgr.get(container.target)[0]){ container.check.setChecked(true,true);}}
      catch(e){container.check.setChecked(false,true);return;}//could not be checked. just return
    };
    this.urlMgr.on("urlmodified",urlModHandler,this);
    this.on("controlrendered",urlModHandler,this);
    return container.check;
  },
  createCombo: function(data,target){
   var dataStore = [];
   data.each(function(dataPoint){
     dataStore.push([dataPoint]);
   });
    var store = new Ext.data.SimpleStore({
      fields:['values'],
      data: dataStore
    });
    var combo = new Ext.form.ComboBox({
      store: store,
      displayField: 'values',
      typeAhead: false,
      mode: 'local',
      triggerAction: 'all',
      emptyText: 'select a '+target
    });
    combo.target = target;
    selectHandler = function(cb,record,index){
      if(index == 0){
        this.urlMgr.reset(target, '');
	this.update();
	return;
      }
      this.urlMgr.reset(target,data[index]);
      this.update();
    };
    urlModHandler = function(){
      try{if(this.urlMgr.get(target)[0]){combo.setValue(this.urlMgr.get(target)[0]);}}
      catch(e){combo.setValue("");}
    }
    combo.on("select",selectHandler,this);
    this.on("controlrendered",urlModHandler,this);
    this.urlMgr.on("urlmodified",urlModHandler,this);
    return new Ext.menu.Adapter(combo);
  },
  modalMenu: function(menuID,title,userMsg,target,validationFunc,inputFailureMessage){
    var urlMgr = this.urlMgr;
    var container = this;
    var modalFunc = function(){
      promptActionFunc = function(btn,text){
        if(btn =='ok'){
	  if(validationFunc){
	    if(validationFunc(text)){
              urlMgr.reset(target,text);
	      container.update();
	    }
	    else{Ext.Msg.prompt(title,inputFailureMessage,promptActionFunc);}
	  }
	  else{
	    urlMgr.reset(target,text);
            container.update();
	  }
        }
      };
      Ext.Msg.prompt(title,userMsg,promptActionFunc);
    };
    /*
    modalFunc.container = this;
    modalFunc.target = target;
    modalFunc.title = title;
    modalFunc.userMsg = userMsg;
    modalFunc.validationFunc = validationFunc;
    modalFunc.inputFailureMessage = inputFailureMessage;
    */

    var modalMenuConfig = {
      id:menuID,
      text:title,
      handler:modalFunc
    };
    return modalMenuConfig;
  },
  colorMenu: function(userText,target){
    var selectHandler = function(cm,color){
      selectHandler.container.urlMgr.reset(selectHandler.target,'%23'+color);
      selectHandler.container.update();
    };
    selectHandler.container = this;
    selectHandler.target = target;
    var clrMenu = {
      text:userText,
      menu:new Ext.menu.ColorMenu({selectHandler:selectHandler})
    };
    return clrMenu
  }
};

var canvasControl = Class.create();
canvasControl.prototype = Object.extend(new composerControl(),{
  initialize: function(urlMgr){
    this.urlMgr = urlMgr;
    this._createCanvasMenu(); // sets menu config objects to edit canvasComponent
  },
  _createCanvasMenu: function(){
    //create menu config(s) and put them in bottom list.
    this.canvasMenu = new Ext.menu.Menu({
      id: 'canvasMenu',
      //modalMenu(menuID,menuText/PromptTitle,PromptMsg,targetID)
      items:[
        this.modalMenu('canvasMenu-graphTitle','Graph Title',"please enter a new title for this graph.","title"),
	this.modalMenu('canvasMenu-yAxisTitle',"Y Axis Label","please enter a new label for the Y Axis.","vtitle"),
	'-',
	{
	  id:'canvasMenu-colors',
	  text:'Canvas Colors',
	  menu:{items:[this.colorMenu("foreground color","fgcolor"),
	               this.colorMenu("background color","bgcolor")]}
	},
	{
	  id:'canvasMenu-graph',
	  text:'graph options',
	  menu:{items:[
	    this.modalMenu('canvasMenu-graph-width',"graph width","please enter a new graph width.","width",parseInt,"you must enter a number! please enter a new graph width."),
            this.modalMenu('canvasMenu-graph-height',"graph height","please enter a new graph height.","height"),
	    this.modalMenu('canvasMenu-graph-lineWidth',"graph line width",
	    "please enter a new graph line width.",'lineWidth',parseInt,
	    "you must enter a number! please enter a new graph width."),
	    //checkMenu(id,text,initialyChecked,checkedVal,uncheckedVal,target)
	    this.checkMenu('canvasMenu-graph-areaMode','area graph',false,'all','none','areaMode'),
	    this.checkMenu('canvasMenu-graph-templateAlphas','use alpha mask',false,'alphas','default','template'),
	    this.checkMenu('canvasMenu-graph-lineMode','staircase line',false,'staircase','slope','lineMode'),
	    this.checkMenu('canvasMenu-graph-graphOnly','Show only Graph',false,true,false,'graphOnly'),
	    this.checkMenu('canvasMenu-graph-hideAxes','Hide Axes',false,true,false,'hideAxes'),
	    this.checkMenu('canvasMenu-graph-hideGrid','Hide Grid',false,true,false,'hideGrid'),
	    this.createCombo(['default','alphas','plain'],'template')
	  ]}
	},
        {
	  id:'canvasMenu-text',
	     text:'Text Options',
	  menu:{items:[
	    this.createCombo(['default','helvetica','times','courier','sans'],"fontName"),
	    this.checkMenu('canvasMenu-text-hideLegend','hide legend',false,true,false,'hideLegend'),
	    this.checkMenu('canvasMenu-text-fontItalic','italicize font',false,true,false,'fontItalic'),
	    this.checkMenu('canvasMenu-text-fontBold','bold font',false,true,false,'fontBold'),
	    this.modalMenu('canvasMenu-text-fontSize',"font size","please enter a new font size.",'fontSize',parseInt,"you must enter a number! please enter a new font size.")
	  ]}
	}
      ]
    });
    this.canvasMenu.rootText = "canvas";
    this.bottomItems.push(this.canvasMenu);
  }
});

var targetControl = Class.create();
targetControl.prototype = Object.extend(new composerControl(),{
  internalClassesInit: function(){
    this.metaInitGridClass();
    this.metaInitContextClass();
  },
  metaInitGridClass: function(){
    this.gridClass = Class.create();
    this.gridClass.prototype = {
      initialize: function(container){
        this.container = container;
        this._createDataStore();
	this.selectedItems = [];
	this.checkboxModel = new Ext.grid.CheckboxSelectionModel();
	this.checkboxModel.on("rowselect",this._rowSelectHandler,this);
	this.checkboxModel.on("rowdeselect",this._rowDeselectHandler,this);
	window._targets = this;
	window.toggleTarget = function(target){window._targets.toggleTarget(target);}
        this._grid = new Ext.grid.GridPanel({
          store:this.targetDataStore,
          columns:[
            this.checkboxModel,
            {header:"target Name",width:340,sortable:true,dataIndex:"target"}
          ],
	  sm:this.checkboxModel
        });
        this.guiControl = new Ext.Window({
          items: [this._grid],
	  title: "Available Targets (right click to modify)",
          width:400,
          height:250
        });
        this.guiControl.on("beforeclose",function(win){
          win.hide();
          return false;
        });
	this.guiControl.on("resize",function(win,width,height){
	  this._grid.setSize(width -10,height -10)
	},this);
      },
      _createDataStore: function(){
        var targetList = this.container.urlMgr.get("target") || [];
	var data = [];
	targetList.each(function(target){data.push([target]);})
        this.targetDataStore = new Ext.data.SimpleStore({
	  fields:["target"],
	  data:data
	});
      },
      _rowSelectHandler: function(selectModel,index,record){
        this.selectedItems.push(record.data.target);
      },
      _rowDeselectHandler: function(selectModel,index,record){
        var selectIndex = this.selectedItems.indexOf(record.data.target);
	this.selectedItems.splice(selectIndex,1);
      },
      show: function(){
        this.update();
        this.guiControl.show();
      },
      hide: function(){
        this.guiControl.hide();
      },
      setContext: function(contextObject){
        this.contextMenu = contextObject;
      },
      update: function(){
        var targetList = this.container.urlMgr.get("target") || [];
	var data = [];
	targetList.each(function(target){data.push([target]);})
	this.targetDataStore.loadData(data,false);
	this.selectedItems.clear();
      },
      getSelected: function(){
	return this.selectedItems.clone();
      },
      getGridControl: function(){
        return this._grid
      },
      getGuiControl: function(){
        return this.guiControl;
      },
      toggleTarget: function(target){
        var mgr = this.container.urlMgr;
	var t = "target";
	var index = mgr.getIndex(t,target);
        index < 0? mgr.set(t,target): mgr.del(t,index);
	this.update();
	this.container.update();
      }
    };
  },
  metaInitContextClass: function(){
    this.contextClass = Class.create();
    this.contextClass.prototype = {
      initialize: function(container,grid){
        this.REMOVECALL = "remove outer call";
	this.EDIT_TARGET = "edit target";
	this.REFRESH = "refresh target list";
	this.BIFs = [this.REMOVECALL,this.EDIT_TARGET,this.REFRESH];
        this.container = container;
        this.grid = grid;
	this.contextMenu = this.generateContextMenu();
	this.grid.getGridControl().on("contextmenu",this.contextHandler,this);
      },
      contextHandler: function(evt){
        if(this.contextMenu.isVisible()){return;}
	this.enableAllMenus(); //start with full set of menus
        var selectedTargets = this.grid.getSelected();
	var urlMgr = this.container.urlMgr;
	//weed out un-useable menus
        if(selectedTargets.length < 1){ 
	  this.disableUnmatchedMenus(["add new target",this.REFRESH]);
	}
	else{
	  var foundFuncCall = selectedTargets.find(function(T){
	    return urlMgr.getAttribute("target",T,"functionCall");
	  });
	  if(!foundFuncCall){this.disableMenu(this.REMOVECALL);}
	}
        this.contextMenu.showAt(evt.getXY());
	evt.stopEvent();
      },
      getAllMenus: function(){
        //return a flat list of all menu items
	var _this = this;
        var iterateMenus = function(menuItem){
          var innerList = []
          try{
            menuItem.items.items.each(function(menu){
              innerList.push(menu);
              if(menu.menu){
                innerList.push(iterateMenus(menu.menu));
              }
            });
          }
          catch(exc){
            return innerList.flatten();
          }
          return innerList.flatten();
        };
	return iterateMenus(this.contextMenu);
      },
      enableAllMenus: function(){
        this.getAllMenus().each(function(menu){menu.enable();});
      },
      disableMenu: function(menuText){
        //disables any menu who's text property == menuText
	var menus = this.getAllMenus()
	menus.each(function(menu){
	  if(menu.text == menuText){menu.disable()}
	})
      },
      disableUnmatchedMenus: function(menuText){
        //disables any menu who's text != menuText, "" or [] acceptable.
	if(typeof menuText == "string"){menuText = [menuText];}
	var menus = this.getAllMenus();
	menus.each(function(menu){
	  var found = menuText.find(function(text){return menu.text == text;});
	  if(!found){menu.disable();}
	});
      },
      functionSelectHandler: function(menu,evt){
        var urlMgr = this.container.urlMgr;
        if(menu.funcName == this.REMOVECALL){ //*******************************************************
	  this.revertCall(menu);
	  return;
	}
	var selected = this.grid.getSelected();
	if(menu.argCount > -1 && selected.length > menu.argCount){
	  var userMsg = "The function "+ menu.funcName +" does not support the number of targets you have chosen. " +
	  "the maximum allowable targets for this function is: "+menu.argCount;
	  Ext.Msg.alert('Invalid target selection',userMsg);
	  return;
	}
	//collect user input if needed and replace individual targets with the one function target
	//using originalSelected because selectedTargets may be modified by user input.
	var functionTargetArgs = {
	  selectedTargets:selected,
	  menuObject:menu,
	  originalSelected:selected.clone(),
	  thisRef: this
	};
	if(urlMgr.getAttribute("functions",menu.funcName,"userInput")){
	  var inputFunc = urlMgr.getAttribute("functions",menu.funcName,"inputMethod");
	  inputFunc(this.createFunctionTarget,this,functionTargetArgs);
	  return;
	}
	this.createFunctionTarget(functionTargetArgs);
      },
      createFunctionTarget: function(targetArgs){
        var _this = targetArgs.thisRef;
        var urlMgr = _this.container.urlMgr;
	var selected = targetArgs.selectedTargets;
	var menu = targetArgs.menuObject;
	var origSelected = targetArgs.originalSelected;
	selected.each(function(item){
	  var index = urlMgr.getIndex("target",item);
	  if(index > -1){urlMgr.del("target",index);}
	});
	var funcStr = menu.funcName+"("+selected.join(",")+")";
	urlMgr.set("target",funcStr);
	urlMgr.setAttribute("target",funcStr,"functionCall",true);
	urlMgr.setAttribute("target",funcStr,"previousTargetState",origSelected)
	_this.container.update();
	_this.grid.update();
	_this.contextMenu.hide();
      },
      revertCall: function(menu){
        var _this = this;
	var urlMgr = this.container.urlMgr
        this.grid.getSelected().each(function(item){
	  if(urlMgr.getAttribute("target",item,"functionCall")){
	    var prevItems = urlMgr.getAttribute("target",item,"previousTargetState");
	    urlMgr.del("target",urlMgr.getIndex("target",item));
	    prevItems.each(function(prevItem){
	      urlMgr.set("target",prevItem);
	    });
	  }
	});
	this.container.update();
	this.grid.update();
	this.contextMenu.hide();
      },
      addToolTip: function(menu){
        if(!menu.toolTip){
	  menu.toolTip = new Ext.ToolTip({
	    autoHide: true,
	    title: menu.argCount < 0?"Function has no argument limits.":"Function takes "+menu.argCount+" arguments.",
	    html: menu.desc,
	    target: menu.el,
	    dismissDelay: 10000
	  });
	  menu.un("render",this.addToolTip,this);
	}
      },
      newTargetHandler: function(menu,evt){
        alert("function not currently available");
	var _this = menu.initialConfig.container;
	_this.contextMenu.hide();
      },
      removeTargetHandler: function(menu,evt){
        var _this = menu.initialConfig.container;
	var urlMgr = _this.container.urlMgr;
        _this.grid.getSelected().each(function(item){
	  urlMgr.del("target",urlMgr.getIndex("target",item));
	});
	_this.container.update();
	_this.grid.update();
	_this.contextMenu.hide();
      },
      generateContextMenu: function(){
	this.funcs = this.getFunctions();
	var funcItems = [];
	var _this = this;
	this.funcs.each(function(func){
          var menuID = func[0]+"_funcID";
          var menuItem = new Ext.menu.Item({
            id:menuID,
            text:func[0]
          });
	  menuItem.funcName = func[0];
	  menuItem.desc = func[1];
	  menuItem.argCount = func[2];
	  menuItem.on("click",_this.functionSelectHandler,_this);
	  menuItem.on("render",_this.addToolTip,_this);
          funcItems.push(menuItem);
        });
	var menu = new Ext.menu.Menu({
          items:[
            {text:"add new target",handler:this.newTargetHandler,container:this},
	    {text:"remove target(s)",handler:this.removeTargetHandler,container:this},
	    {text:"apply function",menu:{items:funcItems}},
	    {text:this.EDIT_TARGET,handler:this.editTargetHandler,container:this},
	    {text:this.REFRESH,handler:this.updateGrid,container:this}
          ]
        });
	return menu;
      },
      editTargetHandler: function(){
        var _this = this.initialConfig.container;
	var target = _this.grid.getSelected();
	var customEdit = function(btn,text){
	  if(btn != "ok"){return}
	  tIndex = customEdit._this.container.urlMgr.getIndex("target",target[0]);
	  customEdit._this.container.urlMgr.set("target",text,tIndex);
	  customEdit._this.grid.update();
	  customEdit._this.container.update();
	};
	customEdit._this = _this;
	if(target.length > 1){Ext.Msg.alert("Too many targets","you can only edit one target at a time.");}
	else{
	  var msgPrompt = Ext.Msg.prompt(
	    "Advanced Target Edit",
	    "Warning you are directly editing a target. This could prevent the entire chart from displaying.",
	    customEdit,
	    true
	  );
	  msgPrompt.getDialog().el.child(".ext-mb-input").dom.value = target[0];
	}
      },
      updateGrid: function(){
        this.initialConfig.container.grid.update();
      },
      getFunctions: function(){
        var data = [
	  //func name, desciption, number of args, -1 is unlimited
          ["averageSeries","transform one or more data streams into one avg stream.",-1],
          ["sum","transform one or more data streams into one summed stream",-1],
          ["derivative","transform one data stream into the stream's dirivative",1],
          ["integral","transform one data stream into the streams integral",1],
          ["scale","tranform one data stream by the specified scale factor.",2],
	  [this.REMOVECALL,"reverts the last function applied to the selected target.",1]
        ];
	var scaleInput = function(callback,thisRef,args){
	  _resultHandler = function(btn,text){
	    if(!btn == 'ok'){return;}
	    if(parseFloat(text)){
	      args.selectedTargets[1] = text;
	      callback(args);
	      return;
	    }
	    Ext.Msg.prompt("scale factor","the value provided was not a number. Please try again.",_resultHandler,thisRef);
	  };
	  Ext.Msg.prompt("scale factor","input a number to scale by",_resultHandler,thisRef)
	};
	//i dont have a good way to setup inputMethod right now, definitly needs to be fixed.
	//inputMethodSig: callback,thisRef,functionTargetArgs
	this.container.urlMgr.setAttribute("functions","scale","userInput",true);
	this.container.urlMgr.setAttribute("functions","scale","inputMethod",scaleInput);
        return data;
      }
    };
  },
  initialize: function(urlMgr){
    this.urlMgr = urlMgr;
    this.internalClassesInit();
    this.grid = new this.gridClass(this);
    this.context = new this.contextClass(this,this.grid);
    this.entryButton = this._createEntryPoint();
    this.on("controlrendered",this._createMetaMenu,this);
    this.bottomItems.push(this.entryButton);
  },
  _createMetaMenu: function(){
    var copyItem = new Ext.menu.Item({text:"copy targets"});
    copyItem.on("click",this.copyTargets,this);
    this.metaMenu = new Ext.menu.Menu({items:[copyItem]});
    this.entryButton.el.on("contextmenu",function(evt){evt.stopEvent();this.metaMenu.showAt(evt.getXY());},this);
  },
  copyTargets: function(){
    var targets = this.urlMgr.get("target") || [];
    var strTargets = '';
    targets.each(function(t){strTargets += t+"\n";});
    if(strTargets){this.graphComposer.userMessage("please copy your targets manually.",strTargets,8);}
    else{this.graphComposer.userMessage("no targets to copy","");}
  },
  _createEntryPoint: function(){
    var targetButton = new Ext.Button({
      text:"targets"
    });
    targetButton.on("click",function(){this.grid.update();this.grid.guiControl.show();},this);
    return targetButton;
  }
});

var timeControl = Class.create();
timeControl.prototype = Object.extend(new composerControl(),{
  internalClassesInit: function(){
    this.metaInitCalendarControl();
  },
  metaInitCalendarControl: function(){
    this.calendarClass = Class.create();
    this.calendarClass.prototype = {
      initialize: function(container){
        this.container = container;
	this.urlMgr = this.container.urlMgr;
	//would like to do this in renderTF, but here for efficency.
	this.tf_scrollRangeMaxLookup = $H({min:59,hr:23,day:31,mon:12,year:new Date().getFullYear()});
	this.tf_scrollRangeMinLookup = $H({min:00,hr:00,day:01,mon:01,year:new Date().getFullYear() - 5});
	this.tf_getDateLookup = $H({from:"getFromDate",until:"getUntilDate"});
	this.tf_setDateLookup = $H({from:"updateFromDate",until:"updateUntilDate"});
	this.tf_getFieldLookup = $H({min:"getMinutes",hr:"getHours",day:"getDate",mon:"getMonth",year:"getFullYear"});
	this.tf_setFieldLookup = $H({min:Date.MINUTE,hr:Date.HOUR,day:Date.DAY,mon:Date.MONTH,year:Date.YEAR});
	//this.tf_setFieldLookup = $H({min:"setMinutes",hr:"setHours",day:"setDay",mon:"setMonth",year:"setFullYear"});
	this.tf_updateEventLookup = $H({from:"cc_from-date-updated",until:"cc_until-date-updated"});
        this._o = new Ext.util.Observable(); //wow what a hack.
        //internal events have form cc_word1-word2-wordN  cc == calendarControl
        this._o.addEvents("cc_from-date-updated");
	this._o.addEvents("cc_until-date-updated");
	this.generateCalendarUI();
	this.generateContext();
	this.generateSurfaceControls();
      },
      on: function(evtStr,func,scope,args){this._o.on(evtStr,func,scope,args);},
      un: function(evtStr,func,scope,args){this._o.un(evtStr,func,scope,args);},
      fireEvent: function(evtStr,args){this._o.fireEvent(evtStr,args);},
      generateCalendarUI: function(){
        var style = "style='font-family: tahoma,arial,verdana,sans-serif; font-size:11px;'";
	var startDateHeader = {html:"<span id='startDateHeader' "+style+">select start date</span>",columns:1,rows:1};
	var endDateHeader = {html:"<span id='endDateHeader' "+style+">select end date</span>", columns:1,rows:1};
	var today = new Date();
	this.generateContext();
	this.startDateControl = new Ext.DatePicker({columns:1,rows:1,maxDate:today});
	this.endDateControl = new Ext.DatePicker({columns:1,rows:1,maxDate:today});
	this.startDateControl.on('select',this.selectHandler,this);
	//this is a bit odd, but i want catch this event and update appropriate calendar control no matter who set the value.
	this.on("cc_from-date-updated",this.fromUpdateHandlerCAL,this);
	this.on("cc_until-date-updated",this.untilUpdateHandlerCAL,this);
	this.endDateControl.on('select',this.selectHandler,this);
	this.guiContainer = new Ext.Window({
	  title: "select time range",
	  layout:'table',
	  height: 300,
	  width: 300,
	  resizable:false,
	  layoutConfig:{
	    columns:2
	  },
	  items: [startDateHeader,endDateHeader,this.startDateControl,this.endDateControl],
	  onEsc: function(){this.hide();return false;}
	});

        this.guiContainer.show();
	this.guiContainer.hide();

	this.startDateControl.toolTip = new Ext.ToolTip({html:"right click for presets.",target:this.startDateControl.el});
        this.endDateControl.toolTip = new Ext.ToolTip({html:"right click for presets.",target:this.endDateControl.el});
	this.startDateControl.toolTip.showTip = true;
	this.endDateControl.toolTip.showTip = true;
	this.startDateControl.toolTip.on("beforeshow",function(){return this.showTip}); //disable property keeps getting reset.
	this.endDateControl.toolTip.on("beforeshow",function(){return this.showTip});

	this.guiContainer.on("beforeclose",this.beforeCalClose,this);
	var size = this.startDateControl.el.getSize();
	size.width = (size.width *2) +15;
	size.height = size.height +50;
	this.guiContainer.setSize(size);
	$('startDateHeader').parentNode.setAttribute("style","background-color: lightblue;");
	$('endDateHeader').parentNode.setAttribute('style','background-color: lightblue;');
	this.guiContainer.initialized = true;
	this.startDateControl.eventEl.on("contextmenu",this.showContext,this);
	this.endDateControl.eventEl.on("contextmenu",this.showContext,this);
	var startNow = this.startDateControl.el.child('td.x-date-today');
	var endNow = this.endDateControl.el.child('td.x-date-today');
	startNow.removeClass('x-date-today');
	endNow.removeClass('x-date-today');
	this.calButton = new Ext.Button({handler:function(){this.initialConfig.container.show();},container:this});
	this.calButton.on("render",function(){
	  try{
	    this.el.child(".x-btn-text").dom.setAttribute('style','padding-left:15pt; background:transparent url(/content/img/calBt.gif) no-repeat scroll 0% 50%');
            this.el.child(".x-btn-text").dom.getAttribute("style").cssText = 'padding-left:15pt; background:transparent url(/content/img/calBt.gif) no-repeat scroll 0% 50%';
	  }catch(e){}
	  this.el.toolTip = new Ext.ToolTip({html:"show calendar",showDelay:100,dismissDelay:10000,target:this.el})
	});
      },
      show: function(){this.guiContainer.show();},
      hide: function(){this.guiContainer.hide();},
      beforeCalClose: function(){
        this.guiContainer.hide();
        return false;
      },
      fromUpdateHandlerCAL: function(dateObj){ 
        this.startDateControl.setValue(dateObj);
      },
      untilUpdateHandlerCAL: function(dateObj){
        this.endDateControl.setValue(dateObj);
      },
      generateContext: function(){
        var container = this.container;
	var _this = this;
        var fromHandler = function(){
	  container.updateFromDate(this.initialConfig.dateVal);
	  container.updateUntilDate("");
	  _this.fireEvent("cc_from-date-updated",container.getFromDate());
	  _this.fireEvent("cc_until-date-updated",container.getUntilDate())
	};
	var untilHandler = function(){
	  container.updateUntilDate(this.initialConfig.dateVal);
	  container.updateFromDate("");
	  _this.fireEvent("cc_until-date-updated",container.getUntilDate());
          _this.fireEvent("cc_from-date-updated",container.getFromDate());
	};
	var clearHandler = function(){
	  container.updateFromDate("");
          _this.fireEvent("cc_from-date-updated",container.getFromDate());
	  container.updateUntilDate("");
	  _this.fireEvent("cc_until-date-updated",container.getUntilDate());
	};
        var intraDay = {text:"intraDay",menu:{items:[
	    {text:"past 30 minutes",handler:fromHandler,dateVal:"-30min"},
	    {text:"past 2 hours",handler:fromHandler,dateVal:"-2h"},
	    {text:"past 4 hours",handler:fromHandler,dateVal:"-4h"},
	    {text:"past 8 hours",handler:fromHandler,dateVal:"-8h"},
	    {text:"past 12 hours",handler:fromHandler,dateVal:"-12h"},
	    {text:"past 16 hours",handler:fromHandler,dateVal:"-16h"},
	    {text:"past 20 hours",handler:fromHandler,dateVal:"-20h"}
	  ]}
	};
	var interDay = {text:"interDay",menu:{items:[
	    {text:"past 1 day",handler:fromHandler,container:this.container,dateVal:"-1d"},
            {text:"past 2 days",handler:fromHandler,container:this.container,dateVal:"-2d"},
	    {text:"past 3 days",handler:fromHandler,container:this.container,dateVal:"-3d"},
	    {text:"past work week",handler:fromHandler,container:this.container,dateVal:"-5d"},
	    {text:"past week",handler:fromHandler,container:this.container,dateVal:"-7d"},
	    {text:"past 2 weeks",handler:fromHandler,container:this.container,dateVal:"-2w"},
	    {text:"past 1 month",handler:fromHandler,container:this.container,dateVal:"-1mon"},
	    {text:"past 1 quarter",handler:fromHandler,container:this.container,dateVal:"-3mon"}
	  ]}
	};
	var clearTime = {text:"clear time",handler:clearHandler};
        this.contextMenu = new Ext.menu.Menu({
	  items:[intraDay,interDay,clearTime]
	});
      },
      generateSurfaceControls: function(){
        //TF==textField, BT=button
	this.absoluteControls = [];
	this.surfaceControls = [];
	this.relativeControls = [];
	var container = this.container;
	var f = "from";
	var u = "until";
	this.surfaceControls.push(this.toggleTypeTF = new Ext.Button(Ext.IsIE?{text:"toggle"}:{}));
	this.toggleTypeTF.rel = true;
	this.toggleTypeTF.cc = this;
	this.toggleTypeTF.on("render",function(){
	  try{
	    this.el.child(".x-btn-text").dom.setAttribute("style","padding-left:15pt; background:transparent url(/content/img/arrow1.gif) no-repeat scroll 0% 50%");
            this.el.child(".x-btn-text").dom.getAttribute("style").cssText = 'padding-left:15pt; background:transparent url(/content/img/arrow1.gif) no-repeat scroll 0% 50%';
	  }catch(e){}
	  this.el.toolTip = new Ext.ToolTip({html:"toggle relative/absolute view",showDelay:100,dismissDelay:10000,target:this.el})
	  this.cc.absoluteControls.each(function(ctl){ctl.hide();});
	});
	this.toggleTypeTF.on("click",this.handleToggleClickTF,this);
	//ABSOLUTE CONTROLS
	this.absoluteControls.push(this.renderTextItem("FROM: "));
	this.absoluteControls.push(this.renderAbsTF(f,"hr"));
	this.absoluteControls.push(this.renderTextItem(": "));
	this.absoluteControls.push(this.renderAbsTF(f,"min"));
	this.absoluteControls.push(this.renderSpacer(),this.renderSpacer(),this.renderSpacer());
	this.absoluteControls.push(this.renderAbsTF(f,"mon"));
	this.absoluteControls.push(this.renderTextItem("/ "));
	this.absoluteControls.push(this.renderAbsTF(f,"day"));
        this.absoluteControls.push(this.renderTextItem("/ "));
	this.absoluteControls.push(this.renderAbsTF(f,"year"));
	this.absoluteControls.push(this.renderSpacer(),this.renderSeparator(),this.renderSpacer());
	//UNTIL SIDE
        this.absoluteControls.push(this.renderTextItem("UNTIL: "));
        this.absoluteControls.push(this.renderAbsTF(u,"hr"));
	this.absoluteControls.push(this.renderTextItem(": "));
	this.absoluteControls.push(this.renderAbsTF(u,"min"));
        this.absoluteControls.push(this.renderSpacer(),this.renderSpacer(),this.renderSpacer());
	this.absoluteControls.push(this.renderAbsTF(u,"mon"));
	this.absoluteControls.push(this.renderTextItem("/ "));
	this.absoluteControls.push(this.renderAbsTF(u,"day"));
	this.absoluteControls.push(this.renderTextItem("/ "));
	this.absoluteControls.push(this.renderAbsTF(u,"year"));
	this.absoluteControls = this.absoluteControls.flatten();

        //RELATIVE CONTROLS
	this.relativeControls.push(this.renderTextItem("FROM:  -"));
	this.relativeControls.push(this.renderRelTF(f));
	this.relativeControls.push(this.renderSpacer(),this.renderSpacer(),this.renderSpacer());
	this.relativeControls.push(this.renderTextItem("UNTIL:  -"));
	this.relativeControls.push(this.renderRelTF(u));
	this.relativeControls = this.relativeControls.flatten();

	this.surfaceControls.push(this.absoluteControls);
	this.surfaceControls.push(this.relativeControls);
	this.surfaceControls.push(this.submitBT = new Ext.Button({handler:function(){container.submit();}}));
	this.submitBT.on("render",function(){
	  try{
	    this.el.child(".x-btn-text").dom.setAttribute('style',"padding-left:15pt; background:transparent url(/content/img/updateGraph.gif) no-repeat scroll 0% 50%");
            this.el.child(".x-btn-text").dom.getAttribute("style").cssText = 'padding-left:15pt; background:transparent url(/content/img/updateGraph.gif) no-repeat scroll 0% 50%';
	  }catch(e){}
	  this.el.toolTip = new Ext.ToolTip({html:"update graph",showDelay:100,dismissDelay:10000,target:this.el})
	});
	this.surfaceControls.flatten();
	this.on("cc_from-date-updated",this.dateUpdatedBT,this.submitBT);
	this.on("cc_until-date-updated",this.dateUpdatedBT,this.submitBT);
      },
      handleToggleClickTF: function(bt,evt){
        if(bt.rel){
	  this.relativeControls.each(function(ctl){ctl.hide()});
	  this.absoluteControls.each(function(ctl){ctl.show();if(ctl.el.style){ctl.el.style.display = "";}});
	  bt.rel = false;
	}
	else{
	  this.absoluteControls.each(function(ctl){ctl.hide()});
	  this.relativeControls.each(function(ctl){ctl.show()});
	  bt.rel = true;
	}
      },
      dateUpdatedBT: function(dateObj){
        var now =  new Date();
	if(!this.lastRun){this.lastRun = now; return}
        //if(!this.lastRun){this.el.frame("ff0000", 1, { duration: 2}); this.lastRun = now;}
	if(this.lastRun.add(Date.SECOND,30).valueOf() > now.valueOf()){return;}
	this.lastRun = now;
        this.el.frame("ff0000", 1, { duration: 2});
      },
      renderTextItem: function(str){
        var ti = new Ext.Toolbar.TextItem(str);
	ti.td = ti.el;
	return ti;
      },
      renderSpacer: function(){
        var sp = new Ext.Toolbar.Spacer();
	sp.td = sp.el;
	return sp;
      },
      renderSeparator: function(){
        var sp = new Ext.Toolbar.Separator();
	sp.td = sp.el;
	return sp;
      },
      renderRelTF: function(groupName){
        var tf = new Ext.form.TextField({
	  id:groupName+"_relative",
	  width:40,
	  emptyText:'',
	  allowBlank: false,
	  validator:this.validateRelTF
	});
	var store = new Ext.data.SimpleStore({
          fields:['display','values'],
          data: [["minutes","min"],["hours","h"],["days","d"],["weeks","w"],["months","mon"],["years","y"]]
        });
        var combo = new Ext.form.ComboBox({
          store: store,
          displayField: 'display',
	  valueField: 'values',
          typeAhead: false,
	  triggerAction: 'all',
          mode: 'local',
	  width:70,
          emptyText: 'range'
        });
	tf.combo = combo;
	combo.tf = tf;
	tf.calControl = this;
	tf.on("render",function(tf){tf.el.on("blur",this.onBlurRelTF,tf);},this);
	combo.on("select",this.relDateSelect,this);
	tf.getDate = this.tf_getDateLookup.get(groupName);
        tf.setDate = this.tf_setDateLookup.get(groupName);
        tf.updateEvent = this.tf_updateEventLookup.get(groupName);
	return [tf,this.renderSpacer(),combo];
      },
      relDateSelect:function(cb,rec,index){
        var tf = cb.tf;
        if(!tf.validate()){return}
        var val =  tf.getValue(); //if there is any value we know its good.
        this.container[tf.setDate](val+rec.data.values);
        this.fireEvent(tf.updateEvent,this.container[tf.getDate]());
      },
      renderAbsTF: function(groupName,emptyText){
        // return config object for textField object.
	var tf = new Ext.form.TextField({
	  id: groupName+"_"+emptyText,
	  width: (emptyText == "year"?35:30),
	  emptyText:emptyText,
	  validator: this.validateAbsTF
	});
	tf.groupName = groupName;
	tf.on("render",this.renderHandlerAbsTF,this);
	return tf;
     },
     renderHandlerAbsTF: function(tf){
        var groupName = tf.groupName;
	var emptyText = tf.emptyText;
	var el = tf.el;
	var dom = tf.el.dom;

	tf.container = this;
	el.container = this;
	dom.container = this;

	tf.getDate = this.tf_getDateLookup.get(groupName);
	el.getDate = tf.getDate;
	dom.getDate = tf.getDate;

	tf.setDate = this.tf_setDateLookup[groupName];
	el.setDate = tf.setDate;
	dom.setDate = tf.setDate;

	tf.scrollRangeMax = this.tf_scrollRangeMaxLookup.get(emptyText);
	el.scrollRangeMax = tf.scrollRangeMax;
	dom.scrollRangeMax = tf.scrollRangeMax;

        tf.scrollRangeMin = this.tf_scrollRangeMinLookup.get(emptyText);
	el.scrollRangeMin = tf.scrollRangeMin;
	dom.scrollRangeMin = tf.scrollRangeMin;

	tf.setField = this.tf_setFieldLookup.get(emptyText);
	el.setField = tf.setField;
	dom.setField = tf.setField;

	tf.getField = this.tf_getFieldLookup.get(emptyText);
	el.getField = tf.getField;
	dom.getField = tf.getFIeld;

	tf.updateEvent = this.tf_updateEventLookup.get(groupName);
	el.updateEvent = tf.updateEvent;
	dom.updateEvent = tf.updateEvent;

        tf.toolTip = new Ext.ToolTip({
	    autoHide: true,
	    title: tf.emptyText,
	    html: "hr:min mon/day/year",
	    target: el,
	    showDelay: 100,
	    dismissDelay: 10000
	  });
	el.on("mousewheel",this.wheelHandlerTF,this);
	el.on("keydown",this.onEscTF,tf);
	tf.on("blur",this.onBlurAbsTF,tf);
	tf.un("render",this.renderHandlerTF,this);
	this.on(tf.updateEvent,this.updatedDateHandlerAbsTF,tf);
	return tf;
      },
      onBlurRelTF: function(evt){
        if(!this.validate()){return}
        var val = this.getValue()[0] == "-"?this.getValue():"-"+this.getValue();
        var cb = this.combo;
        var cal = this.calControl;
        var container = this.calControl.container;
        if(cb.getValue()){
          container[this.setDate](val+cb.getValue());
	  cal.fireEvent(this.updateEvent,container[this.getDate]());
        }
        this.setValue(val);
      },
      onBlurAbsTF : function(evt){
        //container == calendarControl, container.container == calControl.contianer.
	if(this.getRawValue() == this.emptyText){return;}
	var c =this.container; var cc = this.container.container; 
	var val = this.emptyText=="mon"?this.getValue() -1:this.getValue();
        if(this.validate()){
	  var curr = cc[this.getDate]();
	  var CF = curr[this.getField]();
	  var updated = curr.add(this.setField,(val - CF)); //normalize change
	  cc[this.setDate](updated);
	  c.fireEvent(this.updateEvent,cc[this.getDate]());
	}
      },
      wheelHandlerTF: function(evt, dom){
        var delta = evt.getWheelDelta();
	if(!delta){return;}
	var currDate = this.container[dom.getDate]();  //getFrom or getUntil
	currDate = currDate.add(dom.setField,delta);
        this.container[dom.setDate](currDate); // setDate == updateFrom or updateUntil.
	this.fireEvent(dom.updateEvent,this.container[dom.getDate]()); // cc_from-updated || cc_until-updated
      },

      getUIComponents: function(){
        return [this.surfaceControls,this.calButton].flatten();
      },
      selectHandler: function(){
        var endDate = this.endDateControl.getValue();
        var startDate = this.startDateControl.getValue();
	var now = new Date();
	if(startDate.valueOf() >= endDate.valueOf()){ startDate = endDate.add(endDate.DAYS, -1);}
	//make sure we use current hours if applicable.
	var from = this.container.getFromDate();
	var until = this.container.getUntilDate();
	startDate.setHours(from.getHours());
	startDate.setMinutes(from.getMinutes());
	endDate.setHours(until.getHours());
	endDate.setMinutes(until.getMinutes());
	this.container.updateFromDate(startDate);
	this.fireEvent("cc_from-date-updated",this.container.getFromDate());
	this.container.updateUntilDate(endDate);
	this.fireEvent("cc_until-date-updated",this.container.getUntilDate());
      },
      showContext: function(evt){
        if(this.endDateControl.toolTip.showTip){
	  this.endDateControl.toolTip.showTip = false;
	  this.startDateControl.toolTip.showTip = false;
	}
        this.contextMenu.showAt(evt.getXY());
	evt.stopEvent();
      },
      updatedDateHandlerAbsTF: function(dateObj){
        //another hacktastic moment brought to you by javascript
        var offset = this.emptyText == "mon"?1:0;
        this.el.dom.value = dateObj[this.getField]()+offset;
      },
      onEscTF: function(evt){
        if(evt.getKey() == evt.ESC){this.reset();}
      },
      validateAbsTF: function(val){
        var valid = false;
	var rx = /^\d+$/;
	return val.match(rx)?true:false
      },
      validateRelTF: function(val){
        var valid = false;
        var validationRegEx = [/^-\d+/,/^\d+$/];
	validationRegEx.find(function(rx){
	  if(val.match(rx)){valid = true;return true;}
	});
	return valid?true:"";
      }
    };
  },
  initialize: function(urlMgr){
    this.urlMgr = urlMgr;
    this.internalClassesInit();
    this.topItems.push(this._createEntryPoint());
    this.from = this.urlMgr.get("from")?this.decodeDate(this.urlMgr.get("from")[0]):'';
    this.until = this.urlMgr.get("until")?this.decodeDate(this.urlMgr.get("until")[0]):'';
    this.on("controlrendered",this.updateInternalControls,this);
  },
  updateInternalControls: function(){
    this.from?this.calendarControl.fireEvent("cc_from-date-updated",this.getFromDate()):"";
    this.until?this.calendarControl.fireEvent("cc_until-date-updated",this.getUntilDate()):"";
  },
  _createEntryPoint: function(){
    this.calendarControl = new this.calendarClass(this);
    return this.calendarControl.getUIComponents();
  },
  updateFromDate: function(dt){this.from = this._update(dt);},
  updateUntilDate: function(dt){this.until = this._update(dt);},
  _update: function(dt){
    //check the form -#TYPE, as in -20min or -1d
    var relReg = /^-\d+(min)$|(h)$|(y)$|(mon)$|(d)$|(w)$/;
    try{return dt.search(relReg) > -1?dt:"";}
    catch(exc){return typeof dt == "object"?dt:"";}
  },
  getFromDate: function(){return this.from == ""?new Date():this._getDate(this.from);},
  getUntilDate: function(){return this.until == ""?new Date():this._getDate(this.until);},
  _getDate: function(target){
    return typeof target == "object"?target:this.convertRelToDate(target); 
  },
  submit: function(){
    // function to handle any final checks before requesting data from graphite.
    if(this.gt(this.from,this.until)){
      Ext.Msg.alert("the from date you provided is greater than the until date.");
      return
    }
    var fromStr = typeof this.from == "object"?this.encodeDate(this.from):this.from;
    var untilStr = typeof this.until == "object"?this.encodeDate(this.until):this.unitl;
    //could be empty string, thats valid too.
    if(fromStr){this.urlMgr.reset("from",fromStr);}
    else{this.urlMgr.del("from");}
    if(untilStr){this.urlMgr.reset("until",untilStr);}
    else{this.urlMgr.del("until");}
    //might want consider putting soemthing here to stop rapid updates, but that for later.
    this.update();
  },
  encodeDate: function(dateObject){
    //encodes a date object for graphit in a url friendly way.
    var hour = ""+(dateObject.getHours() == 0? "00":dateObject.getHours());
    var minute = ""+(dateObject.getMinutes() == 0 ? "00":dateObject.getMinutes());
    minute = parseInt(minute) < 10? "0"+minute:minute; //minute must always be a double digit.
    var month = ""+(dateObject.getMonth() + 1);
    var day = ""+dateObject.getDate();
    var year = ""+dateObject.getFullYear();
    return hour+"%3A"+minute+month+"%2F"+day+"%2F"+year;
  },
  decodeDate: function(dateStr){
    var dateFmt = /(\d{2}):(\d{2})(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    var match = dateStr.match(dateFmt);
    if(match){
      match.splice(0,1);
      for(i=0;i<match.length;i++){match[i] = parseInt(match[i]);}
      match[2]--; // zero index month;
      return new Date(match[4],match[2],match[3],match[0],match[1]);
    }
    return dateStr;
  },
  convertRelToDate:function(relStr){
    //no scale for "weeks" going to use a scale factor.
    //oh and no endsWith func on str...boooo!
    var scale = relStr[relStr.length -1] == "w"?7:1;
    var ref = new Date();
    if(!relStr){return ref;}
    var regType = /(min)$|(h)$|(y)$|(mon)$|(d)$|(w)$/;
    var regInt = /^-\d+/;
    var lookup = $H({min:Date.MINUTE,h:Date.HOUR,d:Date.DAY,w:Date.DAY,mon:Date.MONTH,y:Date.YEAR});
    return ref.add(lookup.get(relStr.match(regType)[0]),parseInt(relStr.match(regInt)[0])*scale);  
  },
  gt: function(ldate,rdate){
    //use in the form ldate > rdate -> return bool
    //handles date objects and relative date strings.
    ldate = typeof ldate == "object" ? ldate:this.convertRelToDate(ldate);
    rdate = typeof rdate == "object" ? rdate:this.convertRelToDate(rdate);
    return ldate > rdate;
  }
});

var autoUpdaterControl = Class.create();
autoUpdaterControl.prototype = Object.extend(new composerControl(),{
  initialize: function(urlMgr){
    this.urlMgr = urlMgr;
    this.checkBox = new Ext.form.Checkbox();
    this.minCount = new Ext.form.TextField({width:30,value:"1"});
    this.label1 = new Ext.Toolbar.TextItem("update every");
    this.label2 = new Ext.Toolbar.TextItem("min");
    this.spacer =  new Ext.Toolbar.Spacer();
    this.sep = new Ext.Toolbar.Separator()
    this.checkBox.on("check",this.checkHandler,this);
    this.bottomItems.push(this.sep,this.spacer,this.checkBox,this.label1,this.minCount,this.label2);
  },
  checkHandler: function(cb, checked){
    var _this = this;
    if(!this.task){this.task = {run:function(){_this.update();},interval:parseInt(this.minCount.getValue())*60000||60000}}
    if(checked){Ext.TaskMgr.start(this.task);}
    else{Ext.TaskMgr.stop(this.task);}
  }
});

var saveGraphControl = Class.create();
saveGraphControl.prototype = Object.extend(new composerControl(),{
  initialize: function(urlMgr){
    this.urlMgr = urlMgr;
    this.saveBt = new Ext.Button({icon:"/content/img/save.gif"});
    this.saveBt.on("click",this.clickHandler,this);
    window._saveCtl = this;
    window.setURL = function(targetURL){window._saveCtl.setURL(targetURL);}
    this.topItems.push(this.saveBt);
    this.on("controlrendered",this.renderHandler,this.saveBt);
  },
  renderHandler: function(){
    var css = "padding-left:10pt; background:transparent url(/content/img/save.gif) no-repeat scroll 0% 50%";
    try{
      this.el.child(".x-btn-text").dom.setAttribute('style',css);
      this.el.child(".x-btn-text").dom.getAttribute("style").cssText = css;
    }catch(e){}
    this.toolTip = new Ext.ToolTip({
      autoHide: true,
      title: "save to My Graphs",
      html: "save targets, formating or both to the My Graphs folder",
      target: this.el,
      showDelay: 100,
      dismissDelay: 10000
    });
  },
  clickHandler: function(bt,evt){
    var title = "save graph";
    var msg = "enter a graph name to save as...";
    var retryMsg = "you did not provide a name to save as!"
    var saveFunc = function(btn,text){
      if(btn != 'ok'){return;}
      if(!text){Ext.MessageBox.prompt(title,retryMsg,saveFunc,this);return;}
      //send graph name and args to /myGraphs?operation=save
      //indicate success to user if possible.
      Ext.Ajax.on('requestcomplete',this.saveSuccess,this);
      Ext.Ajax.on('requestexception',this.saveFailure,this);
      Ext.Ajax.request({
        url:"/composer/mygraph/",
	method:'GET',
	params: {
	  graphName:text, 
	  action: 'save', 
	  url:encodeURIComponent($('imageviewer').src)
        }
      });
    };
    Ext.MessageBox.prompt(title,msg,saveFunc,this);
  },
  saveSuccess: function(resp,opt,data){
    this.graphComposer.userMessage("save success", "the graph was saved as "+data.params.graphName);
    Ext.Ajax.un('requestcomplete',this.saveSuccess,this);
    Ext.Ajax.un('requestexception',this.saveFailure,this);
  },
  saveFailure: function(resp,opt,data){
    this.graphCompser.userMessage("save failure", "your graph could not be saved");
    Ext.Ajax.un('requestcomplete',this.saveSuccess,this);
    Ext.Ajax.un('requestexception',this.saveFailure,this);
  },
  setURL: function(url){
    var config = this.urlMgr.scrubURL(url);
    this.urlMgr.prePopulate(config);
    this.graphComposer.container.setPosition(0,0);
    //slightly non-standard, we should call this.update(), but composer size probably needs to change
    //as a result of the previously saved graph being a different size. 
    //the standard this.update() does not handle sizing and shouldn't.
    this.graphComposer.container.setSize({height:parseInt(config.height)+70,width:parseInt(config.width)+12});
  }
});

var graphComposer = Class.create();
graphComposer.prototype = {
  /*
    this composer container should host controls that act on the URL string.
    each control should be specific to some specific part of the URL string or in the case
    of menu's act on a specific class of URL strings.
    Each composer control should be r
  */
  initialize: function(args){
    //args
    //composerControls - list of composer controls
    //height - int
    //width - int
    //containingElement - string or domObject
    this.controls = []; 
    this.width = args.width;
    this.height = args.height;
    this.urlMgr = args.urlMgr;
    this.container = args.containingElement;
    this.topMenus = [];
    this.bottomMenus = [];
    this.leftMenus = [];
    this.rightMenus = [];
    var _this = this;
    this.rendered = false;
    args.composerControls.each(function(control){
      _this.addControl(control);
    });
    this.containerConfig = {
      height: args.height,
      width: args.width,
      renderTo: args.containingElement,
      layout: 'border',
      maximizable: true
    };
  },
  _createBox: function(t, s){
    return ['<div class="msg">',
      '<div class="x-box-tl"><div class="x-box-tr"><div class="x-box-tc"></div></div></div>',
      '<div class="x-box-ml"><div class="x-box-mr"><div class="x-box-mc"><h3>', t, '</h3>', s, '</div></div></div>',
      '<div class="x-box-bl"><div class="x-box-br"><div class="x-box-bc"></div></div></div>',
      '</div>'].join('');
  },
  userMessage: function(title,msg,displayTime){
    if(!displayTime){
      var tmpText = title+" "+msg;
      var tmpList = tmpText.split(" ").findAll(function(i){return i;});
      displayTime = parseInt(tmpList.length / 6) || 1;
    }
    while(title.match("\n")){title = title.replace("\n","</br>");}
    while(msg.match("\n")){msg = msg.replace("\n","</br>");}
    var viewer = this.imageViewer.el;
    var frame = Ext.DomHelper.insertFirst(viewer,{id:'myGraphMsg'},true);
    frame.alignTo(viewer,'tl-tl');
    var content = Ext.DomHelper.append(frame,{html:this._createBox(title,msg)}, true);
    content.slideIn('t').pause(displayTime).ghost("t", {remove:true});
  },
  addControl: function(control){
    //typeOf control == composerComponent
    this.controls.push(control);
    control.graphComposer = this;
    control.update = function(){
      if(this.graphComposer.updating){this.graphComposer.updateRequested = true; return;}
      this.graphComposer.updating = true;
      var graphTitle = (graphTitle = this.urlMgr.get('title'))?graphTitle.reduce():"Graphite Composer";
      this.graphComposer.container.setTitle(graphTitle);
      this.graphComposer.imageViewer.disable();
      $('imageviewer').src = this.graphComposer.urlMgr.url();
    };
    if(this.rendered){
      this._addToRendered(control);
      return
    }
    this.topMenus.push(control.joinTop());
    this.bottomMenus.push(control.joinBottom());
    this.rightMenus.push(control.joinRight());
    this.leftMenus.push(control.joinLeft());

  },
  _addToRendered: function(control){
    var _this = _this?_this:this;
    var topBar = _this.container.getTopToolbar();
    var bottomBar = _this.container.getBottomToolbar();
    var leftBar = _this.container.getLeftToolbar();  //needs imp
    var rightBar = _this.container.getRightToolbar(); //needs imp
    control.joinTop().each(function(item){topBar.add(item);});
    control.joinBottom().each(function(item){bottomBar.add(item);});
    control.joinLeft().each(function(item){leftBar.add(item);});
    control.joinRight().each(function(item){rigtBar.add(item);});
    control.onComposerRender(_this);
  },
  newImage: function(){
    this.updating = false;
    this.imageViewer.enable();
    if(this.updateRequested){
      this.updateRequested = false;
      this.controls[0].update(); //pick any control and update.
    }
  },
  badImage: function() {
    this.updating = false;
    this.updateRequested = false;
    // this.imageViewer.enable();
  },
  render: function(){
    if(this.rendered){return;}
    this.prepJoinLists()
    this.containerConfig.tbar = this.topMenuWrapper;
    this.containerConfig.bbar = this.bottomMenuWrapper;
    var leftToolbar = new Ext.Toolbar({items:this.leftMenus,region:"east"});
    var rightToolbar = new Ext.Toolbar({items:this.rightMenus,region:"west"});
    this.imageViewer = new Ext.Panel({
      id:"imageViewerContainer",
      html:"<img id='imageviewer' src='"+window.location.href+"render?&' />",
      region: "center",
      header:false
    });
    this.imageViewer.disable();
    this.containerConfig.items = [leftToolbar,rightToolbar,this.imageViewer];
    this.container = new Ext.Window(this.containerConfig);
    this.container.getLeftToolbar = function(){return this.leftToolbar;}
    this.container.leftToolbar = leftToolbar;
    this.container.getRightToolbar = function(){return this.rightToolbar;}
    this.container.rightToolbar = rightToolbar;
    this.container.graphComposer = this;
    this.container.on("beforeclose",function(panel){return false;});
    this.container.setTitle("Graphite Composer");
    this.container.show(); //showing before we add resize handler
    Ext.get("imageviewer").on("load",this.newImage,this); //not the same as this.imageviewer
    Ext.get("imageviewer").on("error",this.badImage,this);
    this.container.on("resize",this.resizeHandler,this);
    this.resizeHandler(this.container,1,1);//for once size doesn't matter
    this.rendered = true;
    //for each control call onRender callback.
    var composer = this;
    this.controls.each(function(ctl){ctl.onComposerRender(composer);});
  },
  resizeHandler: function(winCtl,width,height){
    this.imageViewer.disable();
    this.urlMgr.reset("width",this.imageViewer.getInnerWidth());
    this.urlMgr.reset("height",this.imageViewer.getInnerHeight());
    $('imageviewer').src = winCtl.graphComposer.urlMgr.url();
  },
  prepJoinLists: function(){
    _this = this;
    this.topMenus = this.topMenus.flatten();
    this.topMenuWrapper = []; //need Ext.Toolbar like config 
    this.topMenus.each(function(menuItem){
      if(menuItem.rootText){
        _this.topMenuWrapper.push({
          text: menuItem.rootText,
	  menu:menuItem
        });
	return;
      }
      _this.topMenuWrapper.push(menuItem);
    });
    this.bottomMenus = this.bottomMenus.flatten();
    this.bottomMenuWrapper = [];
    this.bottomMenus.each(function(menuItem){
      if(menuItem.rootText){
        _this.bottomMenuWrapper.push({
          text: menuItem.rootText,
	  menu:menuItem
        });
	return;
      }
      _this.bottomMenuWrapper.push(menuItem);

    });
    this.rightMenus = this.rightMenus.flatten();
    this.leftMenus = this.leftMenus.flatten();
  }
};

