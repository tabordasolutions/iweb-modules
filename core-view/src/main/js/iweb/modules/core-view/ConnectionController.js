/*
 * Copyright (c) 2008-2016, Massachusetts Institute of Technology (MIT)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
define(['ext', 'iweb/CoreModule'],
	function(Ext, Core){
	
	return Ext.define('modules.core-view.ConnectionController', {
		extend : 'Ext.app.ViewController',

		alias: 'controller.connectioncontroller',
		
		init: function(){
			Core.EventManager.addListener("iweb.connection.disconnected", this.onDisconnect.bind(this));
			Core.EventManager.addListener("iweb.connection.reconnected", this.onReConnect.bind(this));
		},
		
		onDisconnect: function(){
			this.updateImageTag("display:inline;", "padding: 25px; background-color: #FF5733; border-style: solid; border-color: #92a8d1; text-align: center; position: fixed; top: 50% !important; left: 50% !important; margin-top: -50px !important; margin-left: -100px !important;");
		},

		onReConnect: function(){
			this.updateImageTag("display:none;", "background: transparent;");
		},
		
		updateImageTag: function(style, boxStyle){
			var content = this.getView().getContentTarget().child("div");
			var image = content.child("img");
			var message = content.child("div");
			content.dom.setAttribute("style", boxStyle);
			image.dom.setAttribute("style", style);
			message.dom.setAttribute("style", style);
		}
	});
});
	