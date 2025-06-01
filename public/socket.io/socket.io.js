// Socket.io mock to prevent errors
// This file is used as a placeholder for the socket.io library
// which is referenced in the HTML but not actually needed for the status dashboard

console.log('Socket.io mock loaded');

// Export a mock socket that does nothing
window.io = function() {
  return {
    on: function() {},
    emit: function() {},
    connect: function() {},
    disconnect: function() {}
  };
};

