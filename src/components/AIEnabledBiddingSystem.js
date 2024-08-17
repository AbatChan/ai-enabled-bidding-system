import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { usePDF } from 'react-to-pdf';

const AIEnabledBiddingSystem = () => {
  const [formData, setFormData] = useState({
    planSet: null,
    priceReferenceSheet: null,
    supportingDocs: null,
    supportingInfo: '',
    email: '',
    companyLocation: '',
    projectAddress: '',
    projectType: '',
    constructionField: '',
    emailOffers: false
  });
  const [generatedBid, setGeneratedBid] = useState(null);
  const [savedBids, setSavedBids] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSavedBid, setSelectedSavedBid] = useState(null);

  const { toPDF, targetRef } = usePDF({filename: 'generated_bid.pdf'});

  useEffect(() => {
    fetchSavedBids();
  }, []);

  const fetchSavedBids = async () => {
    try {
      const response = await fetch(aiebsData.ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'aiebs_get_user_bids',
          nonce: aiebsData.nonce,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSavedBids(data.data);
      } else {
        console.error('Failed to fetch saved bids:', data.message);
      }
    } catch (error) {
      console.error('Error fetching saved bids:', error);
    }
  };

  const validateFile = (file) => {
    if (!file) return null;
    if (file.size > 100 * 1024 * 1024) return 'File size exceeds 100MB limit';
    if (!['application/pdf'].includes(file.type)) return 'Only PDF files are allowed';
    return null;
  };

  const handleFileUpload = (event, field) => {
    const file = event.target.files[0];
    const fileError = validateFile(file);
    if (fileError) {
      setErrors(prev => ({ ...prev, [field]: fileError }));
    } else {
      setFormData({ ...formData, [field]: file });
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFormData({ ...formData, [name]: newValue });
    validateField(name, newValue);
  };

  const validateField = (name, value) => {
    let error = null;
    switch (name) {
      case 'email':
        if (isEmpty(value)) {
          error = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(value)) {
          error = 'Invalid email format';
        }
        break;
      case 'companyLocation':
        if (isEmpty(value)) error = 'Company Location is required';
        break;
      case 'projectAddress':
        if (isEmpty(value)) error = 'Project Address is required';
        break;
      case 'projectType':
        if (isEmpty(value)) error = 'Project Type is required';
        break;
      case 'constructionField':
        if (isEmpty(value)) error = 'Field of Construction is required';
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const isEmpty = (value) => {
    return value === null || value === undefined || value.trim() === '';
  };

  const validateForm = () => {
    const newErrors = {};
    const requiredFields = ['email', 'companyLocation', 'projectAddress', 'projectType', 'constructionField'];
    
    requiredFields.forEach(field => {
      if (isEmpty(formData[field])) {
        newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      } else {
        validateField(field, formData[field]);
        if (errors[field]) newErrors[field] = errors[field];
      }
    });

    ['planSet', 'priceReferenceSheet', 'supportingDocs'].forEach(field => {
      if (formData[field]) {
        const fileError = validateFile(formData[field]);
        if (fileError) newErrors[field] = fileError;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleError = (error) => {
    console.error('Error:', error);
    let errorMessage = 'An unexpected error occurred. Please try again later.';
    
    if (error.response) {
      if (error.response.status === 404) {
        errorMessage = 'The requested resource could not be found. Please check your input and try again.';
      } else if (error.response.status === 403) {
        errorMessage = 'You do not have permission to access this resource. Please contact support if you believe this is an error.';
      } else if (error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      }
    } else if (error.request) {
      errorMessage = 'No response received from the server. Please check your internet connection and try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }
  
    setErrors(prev => ({ ...prev, submit: errorMessage }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate all fields
    const isValid = validateForm();
    
    if (!isValid) {
      setErrors(prev => ({ ...prev, submit: 'Please fill in all required fields and correct any errors.' }));
      return;
    }

    setIsLoading(true);
    
    const formDataToSend = new FormData();
    for (const key in formData) {
      if (formData[key] instanceof File) {
        formDataToSend.append(key, formData[key]);
      } else {
        formDataToSend.append(key, formData[key]);
      }
    }
    formDataToSend.append('action', 'aiebs_generate_bid');
    formDataToSend.append('nonce', aiebsData.nonce);
  
    console.log('Sending data:', Object.fromEntries(formDataToSend));
  
    try {
      const response = await fetch(aiebsData.ajaxUrl, {
        method: 'POST',
        body: formDataToSend,
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers));
  
      const responseText = await response.text();
      console.log('Response text:', responseText);
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
  
      console.log('Parsed response:', data);
      
      if (data.success) {
        setGeneratedBid(data.data);
        setIsModalOpen(true);
      } else {
        throw new Error(data.data?.message || 'An unknown error occurred');
      }
    // Update the catch block in handleSubmit function
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBid = async () => {
    if (generatedBid) {
      try {
        const response = await fetch(aiebsData.ajaxUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            action: 'aiebs_save_bid',
            nonce: aiebsData.nonce,
            bid: JSON.stringify(generatedBid),
          }),
        });
        const data = await response.json();
        if (data.success) {
          alert('Bid saved successfully!');
          fetchSavedBids(); // Refresh the list of saved bids
        } else {
          alert('Failed to save bid: ' + data.message);
        }
      } catch (error) {
        console.error('Error saving bid:', error);
        alert('An error occurred while saving the bid.');
      }
    }
  };

  const handleSavedBidClick = (bid) => {
    setSelectedSavedBid(bid);
    setIsModalOpen(true);
  };

  const handleDownloadPdf = () => {
    toPDF();
  };

  return document.getElementById('ai-enabled-bidding-system') ? (
    <div className="ai-enabled-bidding-system">
      <div className="p-6 min-h-screen">
        <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-center">AI-Enabled Bidding System</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Plan Set</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'planSet')}
                    className="mt-1 block w-full text-sm text-gray-500
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-sm file:font-semibold
                              file:bg-blue-50 file:text-blue-700
                              hover:file:bg-blue-100"
                  />
                  <p className="text-xs mt-1 text-gray-400">Max: 100 MB, PDF only</p>
                  {errors.planSet && <p className="mt-2 text-sm text-red-600">{errors.planSet}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Price Reference Sheet</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'priceReferenceSheet')}
                    className="mt-1 block w-full text-sm text-gray-500
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-sm file:font-semibold
                              file:bg-blue-50 file:text-blue-700
                              hover:file:bg-blue-100"
                  />
                  <p className="text-xs mt-1 text-gray-400">Max: 100 MB, PDF only</p>
                  {errors.priceReferenceSheet && <p className="mt-2 text-sm text-red-600">{errors.priceReferenceSheet}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Supporting Documentation</label>
                <input
                  type="file"
                  onChange={(e) => handleFileUpload(e, 'supportingDocs')}
                  className="mt-1 block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100"
                />
                <p className="text-xs mt-1 text-gray-400">Max: 100 MB, PDF only</p>
                {errors.supportingDocs && <p className="mt-2 text-sm text-red-600">{errors.supportingDocs}</p>}
              </div>
              <div>
                <label htmlFor="supportingInfo" className="block text-sm font-medium text-gray-700">Supporting Information</label>
                <textarea
                  id="supportingInfo"
                  name="supportingInfo"
                  rows="3"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  placeholder="Enter any supporting information regarding the scope of work"
                  value={formData.supportingInfo}
                  onChange={handleInputChange}
                ></textarea>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={() => validateField('email', formData.email)}
                  />
                  {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="companyLocation" className="block text-sm font-medium text-gray-700">Company Location</label>
                  <input
                    type="text"
                    id="companyLocation"
                    name="companyLocation"
                    className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.companyLocation ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={formData.companyLocation}
                    onChange={handleInputChange}
                    onBlur={() => validateField('companyLocation', formData.companyLocation)}
                  />
                  {errors.companyLocation && <p className="mt-2 text-sm text-red-600">{errors.companyLocation}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="projectAddress" className="block text-sm font-medium text-gray-700">Project Address</label>
                <input
                  type="text"
                  id="projectAddress"
                  name="projectAddress"
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                    errors.projectAddress ? 'border-red-500' : 'border-gray-300'
                  }`}
                  value={formData.projectAddress}
                  onChange={handleInputChange}
                  onBlur={() => validateField('projectAddress', formData.projectAddress)}
                />
                {errors.projectAddress && <p className="mt-2 text-sm text-red-600">{errors.projectAddress}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="projectType" className="block text-sm font-medium text-gray-700">Project Type</label>
                  <select
                    id="projectType"
                    name="projectType"
                    className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.projectType ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={formData.projectType}
                    onChange={handleInputChange}
                    onBlur={() => validateField('projectType', formData.projectType)}
                  >
                    <option value="">Select a project type</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                  </select>
                  {errors.projectType && <p className="mt-2 text-sm text-red-600">{errors.projectType}</p>}
                </div>
                <div>
                  <label htmlFor="constructionField" className="block text-sm font-medium text-gray-700">Field of Construction</label>
                  <select
                    id="constructionField"
                    name="constructionField"
                    className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.constructionField ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={formData.constructionField}
                    onChange={handleInputChange}
                    onBlur={() => validateField('constructionField', formData.constructionField)}
                  >
                    <option value="">Select a field</option>
                    <option value="electrical">Electrical</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="framing">Framing</option>
                    <option value="flooring">Flooring</option>
                    <option value="demolition">Demolition</option>
                  </select>
                  {errors.constructionField && <p className="mt-2 text-sm text-red-600">{errors.constructionField}</p>}
                </div>
              </div>
              <div className="flex items-center">
                <input
                  id="emailOffers"
                  name="emailOffers"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={formData.emailOffers}
                  onChange={handleInputChange}
                />
                <label htmlFor="emailOffers" className="ml-2 block text-sm text-gray-900">
                  Email me offers and news
                </label>
              </div>
              {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}
              <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || Object.values(errors).some(error => error !== null) || ['email', 'companyLocation', 'projectAddress', 'constructionField'].some(field => isEmpty(formData[field]))}
              >
                {isLoading ? 'Generating...' : 'Generate Bid'}
              </button>
              </div>
            </form>
          </div>
        </div>

        <Modal
          isOpen={isModalOpen}
          onRequestClose={() => {
            setIsModalOpen(false);
            setSelectedSavedBid(null);
          }}
          contentLabel="Bid Details"
          className="modal"
          overlayClassName="overlay"
          ariaHideApp={false}
        >
          {(generatedBid || selectedSavedBid) && (
            <div ref={targetRef} className="bg-white p-8 rounded-lg shadow-lg w-[800px] max-w-full mx-auto">
              <h2 className="text-2xl font-bold mb-6">
                {selectedSavedBid ? 'Saved Bid Details' : 'Generated Bid'}
              </h2>
              <div className="space-y-4">
                <p><strong>Project Name:</strong> {(selectedSavedBid || generatedBid).project_name}</p>
                <p><strong>Company Name:</strong> {(selectedSavedBid || generatedBid).company_name}</p>
                <p><strong>Location:</strong> {(selectedSavedBid || generatedBid).location}</p>
                <p><strong>Timeframe:</strong> {(selectedSavedBid || generatedBid).timeframe}</p>
                <p><strong>Description:</strong> {(selectedSavedBid || generatedBid).description}</p>
                <p><strong>Project Type:</strong> {(selectedSavedBid || generatedBid).project_type}</p>
                <p><strong>Construction Field:</strong> {(selectedSavedBid || generatedBid).construction_field}</p>
                <div>
                  <h3 className="font-bold text-lg mt-4 mb-2">Line Items:</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {(selectedSavedBid || generatedBid).lineItems.map((item, index) => (
                      <li key={index}>
                        {item.name}: ${item.price.toFixed(2)} ({item.quantity} {item.unit})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-8 flex justify-start space-x-4">
                {!selectedSavedBid && (
                  <button
                    onClick={handleSaveBid}
                    className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300 ease-in-out transform hover:-translate-y-1 shadow-md"
                  >
                    Save to Dashboard
                  </button>
                )}
                <button
                  onClick={handleDownloadPdf}
                  className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition duration-300 ease-in-out transform hover:-translate-y-1 shadow-md"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedSavedBid(null);
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-300 ease-in-out transform hover:-translate-y-1 shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>

        {savedBids.length > 0 && (
          <div className="mt-8 max-w-3xl mx-auto bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Saved Bids</h2>
              <div className="max-h-60 overflow-y-auto mb-4">
                <ul className="space-y-2">
                  {savedBids.map((bid) => (
                    <li 
                      key={bid.id} 
                      className="bg-gray-100 p-4 rounded cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSavedBidClick(bid)}
                    >
                      {bid.project_name} - {bid.location}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <a 
                  href={`${aiebsData.siteUrl}/${aiebsData.dashboardSlug}`} 
                  className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300 ease-in-out transform hover:-translate-y-1 shadow-md inline-block"
                >
                  Go to Dashboard
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;
};

export default AIEnabledBiddingSystem;