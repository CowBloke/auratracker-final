var menus = document.getElementsByClassName('menu');

function menu(menuIndex) {
  for (var i = 0, len = menus.length; i < len; i++) {
    menus[i].classList.remove('on');
  }
  if (menuIndex !== void 0) {
    menus[menuIndex].classList.add('on');
  }
}

resize();
