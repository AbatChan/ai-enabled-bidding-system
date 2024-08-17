import React, { useState } from 'react';

const AIEditChatBox = ({ bid, onClose, onUpdate }) => {
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch(aiebsData.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'aiebs_ai_edit_suggestion',
                    nonce: aiebsData.nonce,
                    bid_id: bid.id,
                    message: message,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setChatHistory([...chatHistory, { role: 'user', content: message }, { role: 'ai', content: data.suggestion }]);
                setMessage('');
                if (data.updatedBid) {
                    onUpdate(data.updatedBid);
                }
            } else {
                console.error('Failed to get AI suggestion:', data.message);
            }
        } catch (error) {
            console.error('Error getting AI suggestion:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="my-modal">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3 text-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">AI Edit Suggestions</h3>
                    <div className="mt-2 px-7 py-3">
                        <div className="chat-history h-60 overflow-y-auto mb-4">
                            {chatHistory.map((chat, index) => (
                                <div key={index} className={`mb-2 ${chat.role === 'user' ? 'text-right' : 'text-left'}`}>
                                    <span className={`inline-block p-2 rounded-lg ${chat.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                        {chat.content}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleSubmit}>
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none"
                                placeholder="Ask for suggestions..."
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                className="mt-2 bg-blue-500 text-white active:bg-blue-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Loading...' : 'Send'}
                            </button>
                        </form>
                    </div>
                    <div className="items-center px-4 py-3">
                        <button
                            id="ok-btn"
                            className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIEditChatBox;