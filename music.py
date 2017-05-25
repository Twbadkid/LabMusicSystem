from selenium import webdriver
from flask import Flask
from flask import request,abort,send_from_directory
from flask_cors import CORS, cross_origin
import alsaaudio
from selenium.webdriver.common.keys import Keys

app = Flask(__name__,static_url_path='/static')
CORS(app)
chop = webdriver.ChromeOptions()
chop.add_extension('adblockpluschrome.crx')
browser = webdriver.Chrome("./chromedriver",chrome_options = chop)
handles = browser.window_handles
if len(handles)>1:
	browser.switch_to_window(handles[1])
	browser.close()
	browser.switch_to_window(handles[0])

volume  = alsaaudio.Mixer()

import socket,struct

def inMask(ip,net):
	ipaddr = int(''.join([ '%02x' % int(x) for x in ip.split('.') ]), 16)
   	netstr, bits = net.split('/')
   	netaddr = int(''.join([ '%02x' % int(x) for x in netstr.split('.') ]), 16)
   	mask = (0xffffffff << (32 - int(bits))) & 0xffffffff
   	return (ipaddr & mask) == (netaddr & mask)

@app.before_request
def check_source():
	ip = request.remote_addr
	if not inMask(ip,"140.112.0.0/16") and not inMask(ip,"192.168.0.0/16") and ip !="127.0.0.1":
		abort(504)


@app.route('/js/<path:path>')
def send_js(path):
	print path
	return send_from_directory('static/js',path)
@app.route('/css/<path:path>')
def send_css(path):
	return send_from_directory('static/css',path)
@app.route('/image/<path:path>')
def send_image(path):
	return send_from_directory('static/image',path)
@app.route('/fonts/<path:path>')
def send_font(path):
	return send_from_directory('static/fonts',path)
@app.route('/')
def home():
	return app.send_static_file('index.html')


@app.route("/music")
def music():
	y_id= request.args.get("id")
	y_list=request.args.get("list")
	if y_list:
		list_id = "&list=%s"%y_list 
	else:
		list_id = ""
	browser.get("https://www.youtube.com/watch?v=%s%s"%(y_id,list_id))
	return "Change Music . . ."

@app.route("/link")
def link():
	url = request.args.get("url")
	browser.get(url)
	return "Url opened"

@app.route("/get_volume")
def get_volume():
	return str(int(volume.getvolume()[0]))

@app.route("/set_volume")
def set_volume():
	new_volume = request.args.get("volume")
	volume.setvolume(int(new_volume))
	return "Done"

@app.route("/pause_and_play")
def ppap():
	browser.find_element_by_tag_name('video').send_keys(Keys.SPACE)
	return "Done"
@app.route("/get_title")
def get_title():
	return browser.title

if __name__ == "__main__":
	app.run(host='0.0.0.0',threaded=True)
